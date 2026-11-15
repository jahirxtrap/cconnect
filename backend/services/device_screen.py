"""A device's screen mirrored through scrcpy's server: one session per device, shared by every viewer of it."""

import asyncio
import io
import queue
import secrets
import struct
import threading
from contextlib import suppress
from typing import Any, Callable, Optional

import av
from loguru import logger

from core.config import BROWSER_QUALITY
from services import adb, device_tools, frames
from services.devices import DeviceError

SCREEN_FAILED = "screen"
SERVER_PATH = "/data/local/tmp/scrcpy-server.jar"
SERVER_CLASS = "com.genymobile.scrcpy.Server"
STREAM = "stream"
STATE = "state"
VIDEO = "video"
FRAME = "frame"

_SOCKET_PREFIX = "scrcpy"
_LOOPBACK = "127.0.0.1"
_SCID_BITS = 31
_ACCEPT_TIMEOUT = 15.0
_CONNECT_ATTEMPTS = 100
_CONNECT_PAUSE = 0.1
_DEVICE_NAME_BYTES = 64
_CODEC_BYTES = 4
_FRAME_HEADER = struct.Struct(">QI")
_SESSION_HEADER = struct.Struct(">III")
_SESSION_FLAG = 1 << 63
_CONFIG_FLAG = 1 << 62
_KEY_FLAG = 1 << 61
_PTS_MASK = _KEY_FLAG - 1
_SPS_TYPE = 7
_NAL_TYPE_MASK = 0x1F
_START_CODES = (b"\x00\x00\x00\x01", b"\x00\x00\x01")
_MIN_SIZE = 480
_MAX_SIZE = 1920
_SIZE_STEP = 8
_BIT_RATE = 4_000_000
_VIDEO_BACKLOG = 30
_LOG_CHUNK = 4096

_INJECT_KEYCODE = 0
_INJECT_TEXT = 1
_INJECT_TOUCH = 2
_INJECT_SCROLL = 3
_BACK_OR_SCREEN_ON = 4
_SET_DISPLAY_POWER = 10
_ROTATE_DEVICE = 11
_RESET_VIDEO = 17
_CLIPBOARD = 0
_ACK_CLIPBOARD = 1
_UHID_OUTPUT = 2

_ACTIONS = {"down": 0, "up": 1, "move": 2, "cancel": 3}
_PRESSURE_MAX = 0xFFFF
_SCROLL_RANGE = 16
_SCROLL_MAX = 0x7FFF
_TOUCH = struct.Struct(">BBqiiHHHii")
_SCROLL = struct.Struct(">BiiHHhhi")
_KEYCODE = struct.Struct(">BBiii")
_TEXT = struct.Struct(">BI")
_BYTE_PAIR = struct.Struct(">BB")
_SINGLE = struct.Struct(">B")
_LENGTH = struct.Struct(">I")
_CLIPBOARD_ACK = struct.Struct(">Q")
_UHID_HEADER = struct.Struct(">HH")

BACK = "back"
HOME = "home"
RECENTS = "recents"
POWER = "power"
VOLUME_UP = "volume_up"
VOLUME_DOWN = "volume_down"
KEYCODES = {
    HOME: 3,
    BACK: 4,
    VOLUME_UP: 24,
    VOLUME_DOWN: 25,
    POWER: 26,
    RECENTS: 187,
    "Enter": 66,
    "Backspace": 67,
    "Delete": 112,
    "Tab": 61,
    "Escape": 111,
    "ArrowUp": 19,
    "ArrowDown": 20,
    "ArrowLeft": 21,
    "ArrowRight": 22,
    "Home": 122,
    "End": 123,
    "PageUp": 92,
    "PageDown": 93,
}
META = {"shift": 1, "alt": 2, "ctrl": 0x1000, "meta": 0x10000}


def _codec_string(config: bytes) -> str:
    for start in _START_CODES:
        position = 0
        while (position := config.find(start, position)) >= 0:
            header = position + len(start)
            if header + 4 <= len(config) and config[header] & _NAL_TYPE_MASK == _SPS_TYPE:
                profile, constraints, level = config[header + 1:header + 4]
                return f"avc1.{profile:02X}{constraints:02X}{level:02X}"
            position = header
    return ""


def _scroll_units(value: float) -> int:
    return int(max(-1.0, min(1.0, value / _SCROLL_RANGE)) * _SCROLL_MAX)


def _fitted(wanted: int) -> int:
    return max(_MIN_SIZE, min(_MAX_SIZE, wanted)) // _SIZE_STEP * _SIZE_STEP


class _JpegDecoder:
    def __init__(self, loop: asyncio.AbstractEventLoop, publish: Callable[[bytes], None]):
        self._loop = loop
        self._publish = publish
        self._queue: queue.Queue = queue.Queue()
        self._armed = False
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def feed(self, data: bytes, key: bool) -> None:
        if not self._armed:
            if not key:
                return
            self._armed = True
        self._queue.put(data)

    def close(self) -> None:
        self._queue.put(None)

    def _pending(self) -> Optional[list[bytes]]:
        chunk = [self._queue.get()]
        with suppress(queue.Empty):
            while True:
                chunk.append(self._queue.get_nowait())
        return None if None in chunk else chunk

    def _run(self) -> None:
        codec = av.CodecContext.create("h264", "r")
        while (chunk := self._pending()) is not None:
            frame = None
            try:
                for data in chunk:
                    for packet in codec.parse(data):
                        for decoded in codec.decode(packet):
                            frame = decoded
                if frame is None:
                    continue
                buffer = io.BytesIO()
                frame.to_image().save(buffer, format="JPEG", quality=BROWSER_QUALITY)
            except (av.FFmpegError, ValueError, OSError) as exc:
                logger.debug(f"jpeg fallback dropped a frame: {exc}")
                continue
            self._loop.call_soon_threadsafe(self._publish, buffer.getvalue())


class ScreenSession:
    def __init__(self, serial: str):
        self.serial = serial
        self._subscribers: dict[asyncio.Queue, bool] = {}
        self._lock = asyncio.Lock()
        self._running = False
        self._failure: Optional[str] = None
        self._name = ""
        self._size = (0, 0)
        self._config = b""
        self._codec = ""
        self._shell: Optional[adb.Connection] = None
        self._video: Optional[tuple[asyncio.StreamReader, asyncio.StreamWriter]] = None
        self._control: Optional[tuple[asyncio.StreamReader, asyncio.StreamWriter]] = None
        self._listener: Optional[asyncio.AbstractServer] = None
        self._accepted: asyncio.Queue = asyncio.Queue()
        self._tunnel: Optional[tuple[str, Any]] = None
        self._tasks: list[asyncio.Task] = []
        self._decoder: Optional[_JpegDecoder] = None

    @property
    def running(self) -> bool:
        return self._running

    def status(self) -> dict:
        width, height = self._size
        return {"type": STATE, "serial": self.serial, "running": self._running, "name": self._name, "width": width, "height": height, "codec": self._codec, "failure": self._failure}

    def stream_info(self) -> dict:
        width, height = self._size
        return {"type": STREAM, "codec": self._codec, "width": width, "height": height}

    async def watch(self, viewer: asyncio.Queue, video: bool, width: int, height: int) -> None:
        self._subscribers[viewer] = video
        if not self._running:
            await self.start(max(width, height))
        elif self._codec:
            viewer.put_nowait((STREAM, self.stream_info()))
            self.ask_key()
        if not video and self._decoder is None:
            self._decoder = _JpegDecoder(asyncio.get_running_loop(), lambda jpeg: self._publish((FRAME, frames.JPEG_KIND + jpeg)))
            self.ask_key()
        viewer.put_nowait((STATE, self.status()))

    async def unwatch(self, viewer: asyncio.Queue) -> None:
        self._subscribers.pop(viewer, None)
        if self._decoder is not None and all(self._subscribers.values()):
            self._decoder.close()
            self._decoder = None
        if not self._subscribers:
            await self.stop()

    def _command(self, scid: int, size: int, forward: bool) -> str:
        options = {
            "scid": f"{scid:08x}",
            "log_level": "warn",
            "audio": "false",
            "max_size": str(size),
            "video_bit_rate": str(_BIT_RATE),
            "tunnel_forward": "true" if forward else "false",
            "clipboard_autosync": "false",
        }
        return f"CLASSPATH={SERVER_PATH} app_process / {SERVER_CLASS} {device_tools.scrcpy_version()} " + " ".join(f"{key}={value}" for key, value in options.items())

    async def _listen(self) -> int:
        self._accepted = asyncio.Queue()
        self._listener = await asyncio.start_server(lambda reader, writer: self._accepted.put_nowait((reader, writer)), _LOOPBACK, 0)
        return self._listener.sockets[0].getsockname()[1]

    async def _accept(self) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        return await asyncio.wait_for(self._accepted.get(), _ACCEPT_TIMEOUT)

    async def _connect(self, port: int, first: bool) -> tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        for _attempt in range(_CONNECT_ATTEMPTS):
            try:
                reader, writer = await asyncio.open_connection(_LOOPBACK, port)
                if first:
                    await reader.readexactly(1)
                return reader, writer
            except (OSError, asyncio.IncompleteReadError):
                await asyncio.sleep(_CONNECT_PAUSE)
        raise DeviceError(SCREEN_FAILED, "the server did not open its socket")

    async def start(self, wanted: int) -> None:
        async with self._lock:
            if self._running:
                return
            server_file = device_tools.scrcpy_server()
            if server_file is None:
                raise DeviceError(device_tools.MISSING)
            self._failure = None
            try:
                await adb.push(self.serial, str(server_file), SERVER_PATH)
                scid = secrets.randbits(_SCID_BITS)
                socket_name = f"localabstract:{_SOCKET_PREFIX}_{scid:08x}"
                port = await self._listen()
                try:
                    await adb.reverse(self.serial, socket_name, port)
                    self._tunnel = ("reverse", socket_name)
                except adb.AdbError:
                    self._listener.close()
                    self._listener = None
                    port = await adb.forward(self.serial, socket_name)
                    self._tunnel = ("forward", port)
                forward = self._tunnel[0] == "forward"
                self._shell = await adb.transport(self.serial)
                await self._shell.request(f"shell:{self._command(scid, _fitted(wanted), forward)}")
                if forward:
                    self._video = await self._connect(port, True)
                    self._control = await self._connect(port, False)
                else:
                    self._video = await self._accept()
                    self._control = await self._accept()
                reader = self._video[0]
                self._name = (await reader.readexactly(_DEVICE_NAME_BYTES)).split(b"\0", 1)[0].decode("utf-8", "replace")
                await reader.readexactly(_CODEC_BYTES)
            except (adb.AdbError, DeviceError, asyncio.IncompleteReadError, asyncio.TimeoutError, OSError) as exc:
                await self._teardown()
                detail = exc.detail if isinstance(exc, (adb.AdbError, DeviceError)) else str(exc) or type(exc).__name__
                self._failure = detail
                self._publish((STATE, self.status()))
                raise DeviceError(SCREEN_FAILED, detail) from exc
            self._running = True
            self._tasks = [
                asyncio.create_task(self._read_video(reader)),
                asyncio.create_task(self._read_control(self._control[0])),
                asyncio.create_task(self._read_log(self._shell)),
            ]
            self._publish((STATE, self.status()))

    async def stop(self) -> None:
        async with self._lock:
            if not self._running and self._shell is None:
                return
            await self._teardown()
            self._publish((STATE, self.status()))

    async def _teardown(self) -> None:
        self._running = False
        current = asyncio.current_task()
        for task in self._tasks:
            if task is not current:
                task.cancel()
        self._tasks = []
        for held in (self._video, self._control):
            if held is not None:
                held[1].close()
        self._video = self._control = None
        if self._shell is not None:
            self._shell.close()
            self._shell = None
        if self._listener is not None:
            self._listener.close()
            self._listener = None
        tunnel, self._tunnel = self._tunnel, None
        if tunnel is not None:
            with suppress(adb.AdbError, asyncio.IncompleteReadError, OSError):
                if tunnel[0] == "reverse":
                    await adb.remove_reverse(self.serial, tunnel[1])
                else:
                    await adb.remove_forward(self.serial, tunnel[1])
        if self._decoder is not None:
            self._decoder.close()
            self._decoder = None
        self._config = b""
        self._codec = ""
        self._size = (0, 0)

    async def _ended(self, reason: str) -> None:
        if not self._running:
            return
        self._failure = reason
        await self.stop()

    async def _read_video(self, reader: asyncio.StreamReader) -> None:
        try:
            while True:
                header = await reader.readexactly(_FRAME_HEADER.size)
                flagged, size = _FRAME_HEADER.unpack(header)
                if flagged & _SESSION_FLAG:
                    _flags, width, height = _SESSION_HEADER.unpack(header)
                    self._size = (width, height)
                    continue
                data = await reader.readexactly(size)
                if flagged & _CONFIG_FLAG:
                    self._config = data
                    self._codec = _codec_string(data)
                    self._publish((STREAM, self.stream_info()))
                    self._publish((STATE, self.status()))
                    continue
                key = bool(flagged & _KEY_FLAG)
                payload = self._config + data if key else data
                self._publish((VIDEO, (key, frames.video_frame(key, float(flagged & _PTS_MASK), payload))))
                if self._decoder is not None:
                    self._decoder.feed(payload, key)
        except (asyncio.IncompleteReadError, OSError):
            await self._ended("the video stream ended")

    async def _read_control(self, reader: asyncio.StreamReader) -> None:
        with suppress(asyncio.IncompleteReadError, OSError):
            while True:
                kind = (await reader.readexactly(1))[0]
                if kind == _CLIPBOARD:
                    (length,) = _LENGTH.unpack(await reader.readexactly(_LENGTH.size))
                    await reader.readexactly(length)
                elif kind == _ACK_CLIPBOARD:
                    await reader.readexactly(_CLIPBOARD_ACK.size)
                elif kind == _UHID_OUTPUT:
                    _identifier, size = _UHID_HEADER.unpack(await reader.readexactly(_UHID_HEADER.size))
                    await reader.readexactly(size)
                else:
                    return

    async def _read_log(self, shell: adb.Connection) -> None:
        try:
            while True:
                chunk = await shell.reader.read(_LOG_CHUNK)
                if not chunk:
                    break
                logger.debug(f"scrcpy {self.serial}: {chunk.decode('utf-8', 'replace').strip()}")
        except OSError:
            pass
        await self._ended("the server exited")

    def _publish(self, item: tuple[str, Any]) -> None:
        kind = item[0]
        key_wanted = False
        for viewer, video in list(self._subscribers.items()):
            if (kind == VIDEO and not video) or (kind == FRAME and video):
                continue
            pending = []
            while not viewer.empty():
                pending.append(viewer.get_nowait())
            if kind == FRAME:
                pending = [entry for entry in pending if entry[0] != FRAME]
            elif kind == VIDEO:
                waiting = sum(1 for entry in pending if entry[0] == VIDEO)
                if item[1][0]:
                    pending = [entry for entry in pending if entry[0] != VIDEO]
                elif waiting >= _VIDEO_BACKLOG:
                    pending = [entry for entry in pending if entry[0] != VIDEO]
                    key_wanted = True
                    for entry in pending:
                        viewer.put_nowait(entry)
                    continue
            for entry in pending:
                viewer.put_nowait(entry)
            viewer.put_nowait(item)
        if key_wanted:
            self.ask_key()

    def _send(self, message: bytes) -> None:
        if self._control is None:
            return
        with suppress(OSError, RuntimeError):
            self._control[1].write(message)

    def ask_key(self) -> None:
        self._send(_SINGLE.pack(_RESET_VIDEO))

    def touch(self, action: str, pointer: int, x: int, y: int) -> None:
        code = _ACTIONS.get(action)
        if code is None:
            return
        width, height = self._size
        pressure = 0 if action in ("up", "cancel") else _PRESSURE_MAX
        self._send(_TOUCH.pack(_INJECT_TOUCH, code, pointer, x, y, width, height, pressure, 0, 0))

    def scroll(self, x: int, y: int, horizontal: float, vertical: float) -> None:
        width, height = self._size
        self._send(_SCROLL.pack(_INJECT_SCROLL, x, y, width, height, _scroll_units(horizontal), _scroll_units(vertical), 0))

    def key(self, name: str, action: str, modifiers: int) -> None:
        code = _ACTIONS.get(action)
        keycode = KEYCODES.get(name)
        if code is None or keycode is None:
            return
        if name == BACK:
            self._send(_BYTE_PAIR.pack(_BACK_OR_SCREEN_ON, code))
            return
        self._send(_KEYCODE.pack(_INJECT_KEYCODE, code, keycode, 0, modifiers))

    def press(self, name: str) -> None:
        self.key(name, "down", 0)
        self.key(name, "up", 0)

    def text(self, value: str) -> None:
        data = value.encode("utf-8")
        self._send(_TEXT.pack(_INJECT_TEXT, len(data)) + data)

    def display_power(self, on: bool) -> None:
        self._send(_BYTE_PAIR.pack(_SET_DISPLAY_POWER, 1 if on else 0))

    def rotate(self) -> None:
        self._send(_SINGLE.pack(_ROTATE_DEVICE))


_sessions: dict[str, ScreenSession] = {}


def session(serial: str) -> ScreenSession:
    found = _sessions.get(serial)
    if found is None:
        found = _sessions[serial] = ScreenSession(serial)
    return found


def modifiers_of(payload: dict) -> int:
    return sum(flag for name, flag in META.items() if payload.get(name) is True)


async def close_all() -> None:
    for held in list(_sessions.values()):
        await held.stop()
