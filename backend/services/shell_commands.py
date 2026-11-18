"""`!` commands typed in a chat: one run of a command in a folder, as the CLI writes it into the chat."""

from __future__ import annotations

import asyncio
import codecs
import os
import re
import tempfile
from pathlib import Path
from typing import Awaitable, Callable

from core import process_tree
from services import terminal

_PENDING_RE = re.compile(r"<bash-input>([\s\S]*)</bash-input>")
_OUTPUT_LIMIT = 30_000
_READ_SIZE = 4096
_STOP_TIMEOUT = 5.0
_STREAMS = ("stdout", "stderr")
_FOLDER_PREFIX = "cconnect-shell-"
_RESET_NOTICE = "Shell cwd was reset to {}"
_LINE_BREAK = "\n"

INTERRUPTED_CODE = 130
FAILED_CODE = 1

Emit = Callable[[str, str], Awaitable[None]]


def pending_command(text: str) -> str | None:
    """The command a message asks to run: a `<bash-input>` with no output yet."""
    found = _PENDING_RE.fullmatch(text.strip())
    return (found.group(1).strip() or None) if found else None


def prompt_of(command: str, stdout: str, stderr: str, code: int) -> str:
    """The prompt the CLI writes for a `!` command, with its exit code when it failed."""
    failed = f"<bash-exit-code>{code}</bash-exit-code>" if code else ""
    return f"<bash-input>{command}</bash-input><bash-stdout>{stdout}</bash-stdout><bash-stderr>{stderr}</bash-stderr>{failed}"


class _Output:
    """One stream of a run: its start and its end, up to the limit each, and how long it was."""

    def __init__(self):
        self.head = ""
        self.tail = ""
        self.size = 0

    def add(self, piece: str) -> str:
        shown = piece[: max(_OUTPUT_LIMIT - self.size, 0)]
        self.size += len(piece)
        room = _OUTPUT_LIMIT - len(self.head)
        self.head += piece[:room]
        self.tail = (self.tail + piece[room:])[-_OUTPUT_LIMIT:]
        return shown

    def ends_line(self) -> bool:
        return (self.tail or self.head)[-1:] in ("", _LINE_BREAK)

    def clipped(self) -> str:
        if self.size <= _OUTPUT_LIMIT:
            return self.head
        half = _OUTPUT_LIMIT // 2
        return f"{self.head[:half]}\n… {self.size - 2 * half} characters cut …\n{(self.head + self.tail)[-half:]}"


async def _pump(reader: asyncio.StreamReader, output: _Output, stream: str, emit: Emit) -> None:
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    while True:
        chunk = await reader.read(_READ_SIZE)
        piece = terminal.visible_text(decoder.decode(chunk, final=not chunk))
        shown = output.add(piece) if piece else ""
        if shown:
            await emit(stream, shown)
        if not chunk:
            return


def _within(folder: str, root: str) -> bool:
    try:
        return Path(folder).is_dir() and Path(folder).resolve().is_relative_to(Path(root).resolve())
    except OSError:
        return False


def _ended_in(folder_file: str) -> str:
    try:
        return Path(folder_file).read_text(encoding="utf-8").strip()
    except OSError:
        return ""


async def _execute(
    command: str, start: str, folder_file: str, emit: Emit, stop: asyncio.Event
) -> tuple[int, dict[str, _Output]]:
    argv, extra = terminal.one_shot(command, folder_file)
    process = await asyncio.create_subprocess_exec(
        *argv,
        cwd=start,
        env={**os.environ, **extra},
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    outputs = {stream: _Output() for stream in _STREAMS}
    reading = asyncio.ensure_future(
        asyncio.gather(*(_pump(getattr(process, stream), outputs[stream], stream, emit) for stream in _STREAMS))
    )
    stopping = asyncio.ensure_future(stop.wait())
    try:
        await asyncio.wait({reading, stopping}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        interrupted = not reading.done()
        stopping.cancel()
        if interrupted:
            await asyncio.to_thread(process_tree.terminate, process.pid, _STOP_TIMEOUT)
    await reading
    code = await process.wait()
    return (INTERRUPTED_CODE if interrupted else code), outputs


async def run(root: str, folder: str, command: str, emit: Emit, stop: asyncio.Event) -> tuple[str, int, str]:
    """Run one command line from the chat's shell folder, streaming its output, and say where it ended."""
    start = folder if folder and _within(folder, root) else root
    handle, folder_file = tempfile.mkstemp(prefix=_FOLDER_PREFIX)
    os.close(handle)
    try:
        code, outputs = await _execute(command, start, folder_file, emit, stop)
        ended = await asyncio.to_thread(_ended_in, folder_file) or start
    finally:
        Path(folder_file).unlink(missing_ok=True)
    if not _within(ended, root):
        ended = root
        stdout = outputs["stdout"]
        notice = f"{'' if stdout.ends_line() else _LINE_BREAK}{_RESET_NOTICE.format(root)}{_LINE_BREAK}"
        shown = stdout.add(notice)
        if shown:
            await emit("stdout", shown)
    return prompt_of(command, outputs["stdout"].clipped(), outputs["stderr"].clipped(), code), code, ended
