"""The Android devices and emulators of the user's Devices panel, for the clients that can show it."""

import asyncio
import base64
import shlex
from pathlib import Path
from typing import Awaitable, Callable

from mcps.definition import Definition, reply
from services import adb, attachments, device_tools, devices
from services.devices import hub

CAPABILITY = "devices"
GROUP = "devices"
GROUP_SUMMARY = "See and drive the Android devices and emulators of the app's Devices panel."
PREFIX = "device_"
LIST = "device_list"
SCREENSHOT = "device_screenshot"
SHELL = "device_shell"
LOGCAT = "device_logcat"
INPUT = "device_input"
INSTALL = "device_install"
MANAGE = "device_manage"

TAP = "tap"
SWIPE = "swipe"
TEXT = "text"
KEY = "key"
INPUT_ACTIONS = [TAP, SWIPE, TEXT, KEY]

PAIR = "pair"
CONNECT = "connect"
DISCONNECT = "disconnect"
FORGET = "forget"
RENAME = "rename"
START = "start"
STOP = "stop"
INSTALL_TOOLS = "install_tools"
ACTIONS = [PAIR, CONNECT, DISCONNECT, FORGET, RENAME, START, STOP, INSTALL_TOOLS]

DEFAULT_LINES = 200
MAX_LINES = 2000
OUTPUT_TAIL = 8000
SHOT_SIDE = 1280
SWIPE_MILLIS = 300
KEYCODE_PREFIX = "KEYCODE_"
KEYS = {
    "back": "BACK",
    "home": "HOME",
    "recents": "APP_SWITCH",
    "power": "POWER",
    "volume_up": "VOLUME_UP",
    "volume_down": "VOLUME_DOWN",
    "enter": "ENTER",
    "tab": "TAB",
    "delete": "DEL",
    "escape": "ESCAPE",
}
STATES = {
    devices.READY: "authorized",
    devices.UNAUTHORIZED: "unauthorized, waiting for the prompt on the device to be accepted",
    devices.BOOTING: "still booting",
}
FAILURES = (devices.DeviceError, device_tools.ToolsError, adb.AdbError)

SERIAL = {"type": "string", "description": f"The device's serial, from {LIST}; left out when exactly one authorized device is connected."}

DEVICE_LIST = Definition(
    LIST,
    "The Android devices of the user's Devices panel: the phones, tablets and emulators adb sees from the server,"
    " each with its serial, name, Android version, how it is connected and whether it is authorized, then the devices"
    " remembered from before that are not connected, and the emulators of the machine's SDK that are not running."
    " Call it first, to know which serial to pass.",
)

DEVICE_SCREENSHOT = Definition(
    SCREENSHOT,
    "A picture of a device's screen right now. Use it to see what an app shows, check a layout or find out why"
    f" something looks wrong; for text, {SHELL} and {LOGCAT} cost far less.",
    {"type": "object", "properties": {"serial": SERIAL}},
)

DEVICE_SHELL = Definition(
    SHELL,
    "Run a shell command on a device through adb and answer what it prints: dumpsys, pm list packages, am start,"
    " getprop, settings, ls. It runs as the shell user without a terminal, and a long answer is cut at the end.",
    {
        "type": "object",
        "properties": {"serial": SERIAL, "command": {"type": "string", "description": "The command line, as typed after adb shell."}},
        "required": ["command"],
    },
)

DEVICE_LOGCAT = Definition(
    LOGCAT,
    "The latest lines of a device's log. Use it to see why an app crashed or what it printed; filter keeps only"
    " the lines holding a text.",
    {
        "type": "object",
        "properties": {
            "serial": SERIAL,
            "lines": {"type": "integer", "description": f"Lines from the end, {DEFAULT_LINES} by default and at most {MAX_LINES}."},
            "filter": {"type": "string", "description": "A text or regular expression the lines must hold, such as a tag or a package name."},
        },
    },
)

DEVICE_INPUT = Definition(
    INPUT,
    "Touch and type on a device as a user would. tap presses a point, swipe drags from one point to another, text"
    " types into the focused field and key presses a key by name: back, home, recents, power, volume_up, volume_down,"
    f" enter, tab, delete, escape or any Android KEYCODE name. Take a {SCREENSHOT} first to know where things are:"
    " the coordinates are pixels of the screen.",
    {
        "type": "object",
        "properties": {
            "serial": SERIAL,
            "action": {"type": "string", "enum": INPUT_ACTIONS},
            "x": {"type": "integer", "description": "tap and swipe: where the touch starts, from the left."},
            "y": {"type": "integer", "description": "tap and swipe: where the touch starts, from the top."},
            "x2": {"type": "integer", "description": "swipe: where the drag ends, from the left."},
            "y2": {"type": "integer", "description": "swipe: where the drag ends, from the top."},
            "duration": {"type": "integer", "description": f"swipe: how long the drag takes, in milliseconds; {SWIPE_MILLIS} by default."},
            "text": {"type": "string", "description": "text: what to type, ASCII only."},
            "key": {"type": "string", "description": "key: the key's name."},
        },
        "required": ["action"],
    },
)

DEVICE_INSTALL = Definition(
    INSTALL,
    "Install an APK on a device, replacing the app when it is already there. Use it after building an Android app"
    " to try it on the user's phone or on an emulator.",
    {
        "type": "object",
        "properties": {"serial": SERIAL, "path": {"type": "string", "description": "The APK on the server, absolute or from the chat's folder."}},
        "required": ["path"],
    },
)

DEVICE_MANAGE = Definition(
    MANAGE,
    "Manage the user's Devices panel: its paired devices, the saved ones and the emulators. pair pairs a phone over"
    " Wi-Fi with the address and code its Wireless debugging screen shows; connect connects a device already paired by"
    " its address, needed where the server cannot find it by itself, such as over Tailscale; disconnect drops a Wi-Fi"
    " device or shuts an emulator down; forget removes a saved device and rename gives it the name the panel shows;"
    " start boots an emulator by name and stop shuts it down, ending its process when it no longer answers;"
    " install_tools downloads adb and scrcpy's server when the server lacks them.",
    {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ACTIONS},
            "serial": {"type": "string", "description": "disconnect: the device."},
            "address": {"type": "string", "description": "pair and connect: the phone's IP address and port, as host:port."},
            "code": {"type": "string", "description": "pair: the six-digit pairing code the phone shows."},
            "device": {"type": "string", "description": f"forget and rename: the saved device's id, from {LIST}."},
            "name": {"type": "string", "description": "rename: the name the panel shows."},
            "emulator": {"type": "string", "description": f"start and stop: the emulator's name, from {LIST}."},
        },
        "required": ["action"],
    },
)


def needs_key(name: str, args: dict) -> bool:
    return name.startswith(PREFIX)


def _failure(exc: Exception) -> str:
    if exc.reason == device_tools.MISSING:
        return f"The server has no adb or scrcpy; {MANAGE} with {INSTALL_TOOLS} downloads them."
    return f"Failed ({exc.reason}){f': {exc.detail}' if exc.detail else ''}"


async def _answer(work: Callable[[], Awaitable[str]]) -> dict:
    try:
        await hub.ready()
        return reply(await work())
    except FAILURES as exc:
        return reply(_failure(exc), error=True)


def _serial(args: dict) -> str:
    if device_tools.adb_path() is None:
        raise device_tools.ToolsError(device_tools.MISSING)
    given = str(args.get("serial") or "")
    if given:
        return hub.ready_device(given)["serial"]
    ready = [row for row in hub.snapshot()["devices"] if row["state"] == devices.READY]
    if len(ready) == 1:
        return ready[0]["serial"]
    choices = ", ".join(row["serial"] for row in ready)
    raise devices.DeviceError(devices.INVALID, f"pass serial: {choices}" if choices else "no device is connected")


def _device_line(row: dict) -> str:
    traits = [f"Android {row['android']}" if row["android"] else "", row["kind"], STATES.get(row["state"], row["state"])]
    return f"{row['serial']}: {row['name']}, {', '.join(trait for trait in traits if trait)}"


def _saved_line(entry: dict) -> str:
    where = f"last at {entry['address']}" if entry["address"] else "only over USB so far"
    return f"{entry['id']}: {entry['name']}, {entry['model']}, {where}"


def _emulator_line(item: dict) -> str:
    traits = [item["device"], f"API {item['api']}" if item["api"] else ""]
    return f"{item['name']}: {', '.join(trait for trait in traits if trait) or item['label']}"


def _list_text() -> str:
    snapshot = hub.snapshot()
    lines = []
    if snapshot["tools"]["missing"]:
        lines.append(f"The server lacks {' and '.join(snapshot['tools']['missing'])}; {MANAGE} with {INSTALL_TOOLS} downloads them.")
    if snapshot["failure"]:
        lines.append(f"adb: {snapshot['failure']}")
    connected = [_device_line(row) for row in snapshot["devices"]]
    lines.append("Connected:\n" + "\n".join(connected) if connected else "No device is connected.")
    saved = [_saved_line(entry) for entry in snapshot["saved"] if not entry["connected"]]
    if saved:
        lines.append("Saved, not connected:\n" + "\n".join(saved))
    stopped = [_emulator_line(item) for item in snapshot["emulators"] if not item["serial"]]
    if stopped:
        lines.append("Emulators not running:\n" + "\n".join(stopped))
    return "\n\n".join(lines)


def _tail(text: str) -> str:
    body = text.strip()
    return f"…(-{len(body) - OUTPUT_TAIL}){body[-OUTPUT_TAIL:]}" if len(body) > OUTPUT_TAIL else body or "(no output)"


def _keycode(name: str) -> str:
    plain = name.strip()
    code = KEYS.get(plain.lower(), plain.upper())
    return code if code.startswith(KEYCODE_PREFIX) else f"{KEYCODE_PREFIX}{code}"


def _input_command(args: dict) -> tuple[str, str]:
    action = args.get("action")
    x, y = int(args.get("x") or 0), int(args.get("y") or 0)
    if action == TAP:
        return f"input tap {x} {y}", f"Tapped ({x}, {y})."
    if action == SWIPE:
        x2, y2 = int(args.get("x2") or 0), int(args.get("y2") or 0)
        millis = int(args.get("duration") or SWIPE_MILLIS)
        return f"input swipe {x} {y} {x2} {y2} {millis}", f"Swiped from ({x}, {y}) to ({x2}, {y2})."
    if action == TEXT:
        typed = str(args.get("text") or "")
        return f"input text {shlex.quote(typed.replace(' ', '%s'))}", f"Typed {typed!r}."
    if action == KEY:
        code = _keycode(str(args.get("key") or ""))
        return f"input keyevent {code}", f"Pressed {code}."
    raise devices.DeviceError(devices.INVALID, f"action is one of {', '.join(INPUT_ACTIONS)}")


def make_tools(context: dict) -> list:
    if CAPABILITY not in (context.get("capabilities") or ()):
        return []

    session_info = context.get("session_info")

    def cwd() -> str:
        return ((session_info() or {}).get("cwd") if session_info else None) or ""

    def located(raw: str) -> Path:
        path = Path(raw).expanduser()
        return path if path.is_absolute() or not cwd() else Path(cwd()) / path

    async def listed() -> str:
        return _list_text()

    async def shot(args: dict) -> dict:
        image = await devices.screenshot(_serial(args))
        encoded = await asyncio.to_thread(attachments.shrunk, image, SHOT_SIDE) or ("image/png", image)
        return {"content": [{"type": "image", "data": base64.b64encode(encoded[1]).decode("ascii"), "mimeType": encoded[0]}]}

    async def run_shell(args: dict) -> str:
        return _tail(await adb.shell(_serial(args), str(args.get("command") or "")))

    async def read_log(args: dict) -> str:
        count = min(max(int(args.get("lines") or DEFAULT_LINES), 1), MAX_LINES)
        pattern = str(args.get("filter") or "")
        command = f"logcat -d -t {count}" + (f" -e {shlex.quote(pattern)}" if pattern else "")
        return _tail(await adb.shell(_serial(args), command))

    async def inject(args: dict) -> str:
        serial = _serial(args)
        command, done = _input_command(args)
        output = (await adb.shell(serial, command)).strip()
        return f"{done} {output}" if output else done

    async def install_apk(args: dict) -> str:
        serial = _serial(args)
        path = located(str(args.get("path") or ""))
        if not path.is_file():
            raise devices.DeviceError(devices.MISSING, str(path))
        return (await adb.install(serial, str(path))).strip() or f"Installed {path.name}."

    async def saved_change(work: Callable[[], object], done: str) -> str:
        await asyncio.to_thread(work)
        hub.reload_saved()
        return done

    async def manage(args: dict) -> str:
        action = args.get("action")
        address = str(args.get("address") or "")
        device_id = str(args.get("device") or "")
        emulator = str(args.get("emulator") or "")
        if action == PAIR:
            return await devices.pair(address, str(args.get("code") or ""))
        if action == CONNECT:
            return await devices.connect(address)
        if action == DISCONNECT:
            serial = str(args.get("serial") or "")
            await devices.disconnect(serial)
            return f"Disconnected {serial}."
        if action == FORGET:
            return await saved_change(lambda: devices.forget(device_id), f"Forgot {device_id}; pair it again to use it over Wi-Fi.")
        if action == RENAME:
            name = str(args.get("name") or "")
            return await saved_change(lambda: devices.rename(device_id, name), f"Renamed {device_id} to {name}.")
        if action == START:
            await asyncio.to_thread(devices.start_emulator, emulator)
            return f"Starting {emulator}; it appears in {LIST} once booted."
        if action == STOP:
            await devices.stop_emulator(emulator)
            return f"Stopped {emulator}."
        if action == INSTALL_TOOLS:
            await hub.install_tools()
            return "Installed adb and scrcpy's server on the server." if not device_tools.missing() else f"Still missing {' and '.join(device_tools.missing())}."
        return f"action is one of {', '.join(ACTIONS)}."

    @DEVICE_LIST
    async def device_list(args):
        return await _answer(listed)

    @DEVICE_SCREENSHOT
    async def device_screenshot(args):
        try:
            await hub.ready()
            return await shot(args)
        except FAILURES as exc:
            return reply(_failure(exc), error=True)

    @DEVICE_SHELL
    async def device_shell(args):
        return await _answer(lambda: run_shell(args))

    @DEVICE_LOGCAT
    async def device_logcat(args):
        return await _answer(lambda: read_log(args))

    @DEVICE_INPUT
    async def device_input(args):
        return await _answer(lambda: inject(args))

    @DEVICE_INSTALL
    async def device_install(args):
        return await _answer(lambda: install_apk(args))

    @DEVICE_MANAGE
    async def device_manage(args):
        return await _answer(lambda: manage(args))

    return [device_list, device_screenshot, device_shell, device_logcat, device_input, device_install, device_manage]
