"""adb's host protocol over its server socket, with the server started when nothing listens on it."""

import asyncio
import subprocess
from pathlib import Path
from typing import AsyncIterator

from core.packages import NO_WINDOW
from services import device_tools

HOST = "127.0.0.1"
PORT = 5037
FAILED = "adb"

_OKAY = b"OKAY"
_FAIL = b"FAIL"
_LENGTH_DIGITS = 4
_COMMAND_TIMEOUT = 120
_OUTPUT_TAIL = 2000
_CONSOLE_TOKEN_FILE = Path.home() / ".emulator_console_auth_token"
_CONSOLE_OK = b"OK"
_CONSOLE_KO = b"KO:"
_CONSOLE_TIMEOUT = 10


class AdbError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


class Connection:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        self.reader = reader
        self.writer = writer

    async def send(self, service: str) -> None:
        payload = service.encode("utf-8")
        self.writer.write(f"{len(payload):0{_LENGTH_DIGITS}x}".encode("ascii") + payload)
        await self.writer.drain()

    async def status(self) -> None:
        head = await self.reader.readexactly(len(_OKAY))
        if head == _OKAY:
            return
        if head == _FAIL:
            raise AdbError(FAILED, await self.string())
        raise AdbError(FAILED, f"unexpected reply {head!r}")

    async def string(self) -> str:
        head = await self.reader.readexactly(_LENGTH_DIGITS)
        if head == _FAIL:
            raise AdbError(FAILED, await self.string())
        return (await self.reader.readexactly(int(head, 16))).decode("utf-8", "replace")

    async def request(self, service: str) -> None:
        await self.send(service)
        await self.status()

    async def read_all(self) -> bytes:
        return await self.reader.read(-1)

    def write(self, data: bytes) -> None:
        self.writer.write(data)

    def close(self) -> None:
        self.writer.close()


def executable() -> str:
    found = device_tools.adb_path()
    if found is None:
        raise AdbError(device_tools.MISSING)
    return found


async def run(*args: str, timeout: float = _COMMAND_TIMEOUT) -> str:
    process = await asyncio.create_subprocess_exec(
        executable(), *args,
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        creationflags=NO_WINDOW,
    )
    try:
        output, _ = await asyncio.wait_for(process.communicate(), timeout)
    except asyncio.TimeoutError as exc:
        process.kill()
        raise AdbError(FAILED, f"adb {' '.join(args)} did not finish") from exc
    text = output.decode("utf-8", "replace").strip()
    if process.returncode != 0:
        raise AdbError(FAILED, text[-_OUTPUT_TAIL:])
    return text


async def start_server() -> None:
    await run("start-server")


async def server() -> Connection:
    try:
        reader, writer = await asyncio.open_connection(HOST, PORT)
    except OSError:
        await start_server()
        try:
            reader, writer = await asyncio.open_connection(HOST, PORT)
        except OSError as exc:
            raise AdbError(FAILED, "the adb server is not listening") from exc
    return Connection(reader, writer)


async def query(service: str) -> str:
    link = await server()
    try:
        await link.request(service)
        return await link.string()
    finally:
        link.close()


async def track(service: str) -> AsyncIterator[str]:
    link = await server()
    try:
        await link.request(service)
        while True:
            yield await link.string()
    finally:
        link.close()


async def transport(serial: str) -> Connection:
    link = await server()
    try:
        await link.request(f"host:transport:{serial}")
    except (AdbError, asyncio.IncompleteReadError):
        link.close()
        raise
    return link


async def exec_out(serial: str, command: str, timeout: float = _COMMAND_TIMEOUT) -> bytes:
    link = await transport(serial)
    try:
        await link.request(f"exec:{command}")
        return await asyncio.wait_for(link.read_all(), timeout)
    except asyncio.TimeoutError as exc:
        raise AdbError(FAILED, f"{command} did not finish") from exc
    finally:
        link.close()


async def shell(serial: str, command: str, timeout: float = _COMMAND_TIMEOUT) -> str:
    return (await exec_out(serial, command, timeout)).decode("utf-8", "replace")


async def properties(serial: str, names: tuple[str, ...]) -> dict[str, str]:
    lines = (await shell(serial, "; ".join(f"getprop {name}" for name in names))).split("\n")
    return {name: (lines[index].strip() if index < len(lines) else "") for index, name in enumerate(names)}


async def forward(serial: str, remote: str) -> int:
    link = await server()
    try:
        await link.request(f"host-serial:{serial}:forward:tcp:0;{remote}")
        await link.status()
        return int(await link.string())
    finally:
        link.close()


async def remove_forward(serial: str, port: int) -> None:
    link = await server()
    try:
        await link.request(f"host-serial:{serial}:killforward:tcp:{port}")
        await link.status()
    finally:
        link.close()


async def reverse(serial: str, remote: str, port: int) -> None:
    link = await transport(serial)
    try:
        await link.request(f"reverse:forward:{remote};tcp:{port}")
    finally:
        link.close()


async def remove_reverse(serial: str, remote: str) -> None:
    link = await transport(serial)
    try:
        await link.request(f"reverse:killforward:{remote}")
    finally:
        link.close()


async def pair(address: str, code: str) -> str:
    return await query(f"host:pair:{code}:{address}")


async def connect(address: str) -> str:
    return await query(f"host:connect:{address}")


async def disconnect(target: str) -> str:
    return await query(f"host:disconnect:{target}")


async def push(serial: str, source: str, destination: str) -> None:
    await run("-s", serial, "push", source, destination)


async def install(serial: str, apk: str) -> str:
    return await run("-s", serial, "install", "-r", apk)


async def kill_emulator(serial: str) -> None:
    await run("-s", serial, "emu", "kill")


async def _console_reply(reader: asyncio.StreamReader) -> str:
    lines = []
    while True:
        line = await asyncio.wait_for(reader.readline(), _CONSOLE_TIMEOUT)
        if not line:
            raise AdbError(FAILED, "the emulator console closed")
        if line.rstrip(b"\r\n") == _CONSOLE_OK:
            return "".join(lines)
        if line.startswith(_CONSOLE_KO):
            raise AdbError(FAILED, line.decode("utf-8", "replace").strip())
        lines.append(line.decode("utf-8", "replace"))


async def console(port: int, command: str) -> str:
    try:
        reader, writer = await asyncio.open_connection(HOST, port)
    except OSError as exc:
        raise AdbError(FAILED, f"the emulator console on {port} is not listening") from exc
    try:
        await _console_reply(reader)
        if _CONSOLE_TOKEN_FILE.is_file():
            writer.write(f"auth {_CONSOLE_TOKEN_FILE.read_text(encoding='utf-8').strip()}\n".encode("utf-8"))
            await writer.drain()
            await _console_reply(reader)
        writer.write(f"{command}\n".encode("utf-8"))
        await writer.drain()
        return (await _console_reply(reader)).strip()
    except asyncio.TimeoutError as exc:
        raise AdbError(FAILED, f"the emulator console on {port} did not answer") from exc
    finally:
        writer.close()

