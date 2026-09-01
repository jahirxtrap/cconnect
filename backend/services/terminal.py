"""Pseudo-terminals on the machine running the backend, relayed as raw bytes to the sockets
attached to each one."""

from __future__ import annotations

import asyncio
import hmac
import os
import re
import shutil
import sys
import threading
import time
import uuid
from contextlib import suppress
from pathlib import Path
from typing import Optional

import psutil

from core.config import DEFAULT_CWD, TERMINAL_ACCESS_KEY
from services import settings_store

_WINDOWS = sys.platform == "win32"

if _WINDOWS:
    from winpty import PtyProcess
else:
    from ptyprocess import PtyProcess

_SCROLLBACK_BYTES = 256 * 1024
_READ_SIZE = 8192
_DEFAULT_COLS = 80
_DEFAULT_ROWS = 24
_TERM = "xterm-256color"
_CONPTY_BUILD = 17763

ANSI_OSC = re.compile(r"\x1b\][^\x07]*\x07")
ANSI_CSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
ANSI_QUERY = re.compile(rb"\x1b\[[0-9;?>=]*[cn]")

_terminals: dict[str, "Terminal"] = {}


def strip_ansi(raw: str) -> str:
    return ANSI_CSI.sub("", ANSI_OSC.sub("", raw))


def visible_text(raw: str) -> str:
    """Only what a terminal ends up showing: escapes gone and each line's repaints collapsed."""
    lines = []
    for line in strip_ansi(raw).split("\n"):
        settled = line.rstrip("\r")
        lines.append(settled.rsplit("\r", 1)[-1])
    return "\n".join(lines)


def _read(proc) -> bytes:
    data = proc.read(_READ_SIZE)
    return data.encode("utf-8") if isinstance(data, str) else data


def _write(proc, data: bytes) -> None:
    proc.write(data.decode("utf-8", errors="replace") if _WINDOWS else data)


_WINDOWS_SHELLS = (("pwsh", "-NoLogo"), ("powershell", "-NoLogo"))


def _shell() -> list[str]:
    """The shell to spawn: the configured one, else PowerShell on Windows and $SHELL elsewhere."""
    configured = (settings_store.get("terminal_shell") or "").strip()
    if configured:
        return [configured]
    if not _WINDOWS:
        return [os.environ.get("SHELL") or shutil.which("bash") or "/bin/sh"]
    for name, *args in _WINDOWS_SHELLS:
        found = shutil.which(name)
        if found:
            return [found, *args]
    return [os.environ.get("COMSPEC") or "cmd.exe"]


class Terminal:
    def __init__(self, session_id: str, title: str, cwd: str, argv: list[str], cols: int, rows: int) -> None:
        self.id = session_id
        self.title = title
        self.cwd = cwd
        self.shell = argv[0]
        self.cols = cols
        self.rows = rows
        self.alive = True
        self.exit_status: Optional[int] = None
        self.created_at = time.time()
        env = dict(os.environ)
        env["TERM"] = _TERM
        self._proc = PtyProcess.spawn(argv, cwd=cwd, env=env, dimensions=(rows, cols))
        self.pid = self._proc.pid
        self._loop = asyncio.get_running_loop()
        self._scrollback = bytearray()
        self._listeners: set[asyncio.Queue] = set()
        self._sizes: dict[int, tuple[int, int]] = {}
        threading.Thread(target=self._pump, daemon=True).start()

    def _pump(self) -> None:
        while True:
            try:
                data = _read(self._proc)
            except (EOFError, OSError):
                break
            if data:
                self._loop.call_soon_threadsafe(self._publish, data)
        status = None
        with suppress(Exception):
            status = self._proc.wait()
        self._loop.call_soon_threadsafe(self._finish, status)

    def _publish(self, data: bytes) -> None:
        self._scrollback += data
        if len(self._scrollback) > _SCROLLBACK_BYTES:
            del self._scrollback[:-_SCROLLBACK_BYTES]
        for queue in self._listeners:
            queue.put_nowait(data)

    def _finish(self, status: Optional[int]) -> None:
        self.alive = False
        self.exit_status = status
        for queue in self._listeners:
            queue.put_nowait(None)

    def _apply_size(self) -> None:
        if not self._sizes:
            return
        cols = min(size[0] for size in self._sizes.values())
        rows = min(size[1] for size in self._sizes.values())
        if (cols, rows) == (self.cols, self.rows):
            return
        self.cols, self.rows = cols, rows
        with suppress(Exception):
            self._proc.setwinsize(rows, cols)

    def attach(self, cols: int, rows: int) -> tuple[bytes, asyncio.Queue]:
        """The scrollback so far, with its terminal queries dropped, plus the live queue."""
        queue: asyncio.Queue = asyncio.Queue()
        self._listeners.add(queue)
        self._sizes[id(queue)] = (cols or self.cols, rows or self.rows)
        self._apply_size()
        return ANSI_QUERY.sub(b"", bytes(self._scrollback)), queue

    def detach(self, queue: asyncio.Queue) -> None:
        self._listeners.discard(queue)
        self._sizes.pop(id(queue), None)
        self._apply_size()
        if not self._listeners and not self.alive:
            _terminals.pop(self.id, None)

    def resize(self, queue: asyncio.Queue, cols: int, rows: int) -> None:
        if cols <= 0 or rows <= 0:
            return
        self._sizes[id(queue)] = (cols, rows)
        self._apply_size()

    def tail(self, limit: int) -> str:
        """What the terminal shows, with the escape sequences stripped."""
        text = visible_text(bytes(self._scrollback).decode("utf-8", errors="replace"))
        return text[-limit:] if limit > 0 else text

    def write(self, data: bytes) -> None:
        if self.alive:
            with suppress(Exception):
                _write(self._proc, data)

    def close(self) -> None:
        with suppress(Exception):
            self._proc.terminate(force=True)


def busy(term: Terminal) -> bool:
    """Whether the shell has a child process running."""
    if not term.alive:
        return False
    try:
        return bool(psutil.Process(term.pid).children())
    except (psutil.Error, OSError):
        return False


def _pty_info() -> dict:
    """Which pty the shells run on, so a client can apply the quirks of that one."""
    if not _WINDOWS:
        return {"backend": "pty", "build": None}
    build = sys.getwindowsversion().build
    return {"backend": "conpty" if build >= _CONPTY_BUILD else "winpty", "build": build}


_PTY = _pty_info()


def meta(term: Terminal) -> dict:
    return {
        "id": term.id,
        "title": term.title,
        "cwd": term.cwd,
        "shell": term.shell,
        "pty": _PTY,
        "cols": term.cols,
        "rows": term.rows,
        "alive": term.alive,
        "busy": busy(term),
        "exit_status": term.exit_status,
        "created_at": term.created_at,
    }


def key_matches(candidate: str) -> bool:
    """False while no key exists, which leaves the terminal locked."""
    return bool(TERMINAL_ACCESS_KEY) and hmac.compare_digest(candidate or "", TERMINAL_ACCESS_KEY)


def _root(candidates: Optional[list[str]]) -> str:
    """The first candidate directory that exists, falling back to the user's home."""
    for candidate in candidates or []:
        clean = (candidate or "").strip()
        if clean and Path(clean).is_dir():
            return clean
    return str(Path.home())


def create(cwd: Optional[list[str]] = None, title: Optional[str] = None, cols: int = 0, rows: int = 0) -> dict:
    root = _root(cwd)
    session_id = uuid.uuid4().hex[:12]
    term = Terminal(
        session_id,
        (title or "").strip() or Path(root).name or root,
        root,
        _shell(),
        cols or _DEFAULT_COLS,
        rows or _DEFAULT_ROWS,
    )
    _terminals[session_id] = term
    return meta(term)


def get(session_id: str) -> Optional[Terminal]:
    return _terminals.get(session_id)


def listing() -> list[dict]:
    return [meta(term) for term in sorted(_terminals.values(), key=lambda item: item.created_at)]


def close(session_id: str) -> bool:
    term = _terminals.pop(session_id, None)
    if term is None:
        return False
    term.close()
    return True


def close_all() -> None:
    for session_id in list(_terminals):
        close(session_id)
