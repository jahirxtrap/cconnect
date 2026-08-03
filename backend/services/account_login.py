"""Remote OAuth login for an account: the CLI prints an authorization URL, the user
approves it on any device and pastes the resulting code back.

``claude setup-token`` only renders inside a real terminal, so it is driven through a
pseudo-terminal and its output scraped for the URL.
"""

from __future__ import annotations

import os
import re
import shutil
import sys
import threading
import time
from typing import Optional

from services import accounts

_WINDOWS = sys.platform == "win32"

_URL_RE = re.compile(r"https?://[^\s\"'<>\\]+")
_ANSI_OSC = re.compile(r"\x1b\][^\x07]*\x07")
_ANSI_CSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
_COLUMNS = 1000
_URL_TIMEOUT = 30.0
_LOGIN_TIMEOUT = 90.0

_sessions: dict[str, "_LoginSession"] = {}


def _clean(raw: str) -> str:
    return _ANSI_CSI.sub("", _ANSI_OSC.sub("", raw))


def _find_url(text: str) -> Optional[str]:
    for line in text.splitlines():
        match = _URL_RE.search(line)
        if match and "oauth" in match.group(0):
            return match.group(0)
    return None


class _LoginSession:
    def __init__(self, account_id: str) -> None:
        self.account_id = account_id
        self.buffer = ""
        self.error: Optional[str] = None
        self._proc = None
        self._lock = threading.Lock()

    def _spawn(self):
        executable = shutil.which("claude")
        if not executable:
            raise RuntimeError("claude CLI not found")
        env = dict(os.environ)
        env.update(accounts.env_for(self.account_id))
        env["BROWSER"] = "echo"
        args = [executable, "auth", "login", "--claudeai"]
        if _WINDOWS:
            from winpty import PtyProcess
            return PtyProcess.spawn(args, env=env, dimensions=(40, _COLUMNS))
        import ptyprocess
        return ptyprocess.PtyProcessUnicode.spawn(args, env=env, dimensions=(40, _COLUMNS))

    def _pump(self) -> None:
        while True:
            try:
                data = self._proc.read(4096)
            except (EOFError, OSError):
                break
            if data:
                with self._lock:
                    self.buffer += data

    def start(self) -> str:
        self._proc = self._spawn()
        threading.Thread(target=self._pump, daemon=True).start()
        deadline = time.time() + _URL_TIMEOUT
        while time.time() < deadline:
            with self._lock:
                url = _find_url(_clean(self.buffer))
            if url:
                return url
            time.sleep(0.3)
        raise RuntimeError("the CLI did not return an authorization URL")

    def submit(self, code: str) -> bool:
        if self._proc is None:
            return False
        with self._lock:
            self.buffer = ""
        self._proc.write(code.strip() + "\r")
        deadline = time.time() + _LOGIN_TIMEOUT
        while time.time() < deadline and self._proc.isalive():
            if accounts.is_logged_in(self.account_id):
                break
            time.sleep(1.0)
        ok = accounts.is_logged_in(self.account_id)
        self.close()
        return ok

    def output(self) -> str:
        with self._lock:
            return _clean(self.buffer)

    def close(self) -> None:
        if self._proc is not None:
            try:
                self._proc.terminate(force=True)
            except Exception:
                pass
            self._proc = None


def start(account_id: str) -> dict:
    cancel(account_id)
    session = _LoginSession(account_id)
    try:
        url = session.start()
    except Exception as exc:
        session.close()
        return {"ok": False, "message": str(exc), "output": session.output()}
    _sessions[account_id] = session
    return {"ok": True, "url": url}


def submit_code(account_id: str, code: str) -> dict:
    session = _sessions.pop(account_id, None)
    if session is None:
        return {"ok": False, "message": "no login in progress"}
    try:
        ok = session.submit(code)
    except Exception as exc:
        session.close()
        return {"ok": False, "message": str(exc)}
    return {"ok": bool(ok), "message": None if ok else "the code was not accepted"}


def cancel(account_id: str) -> None:
    session = _sessions.pop(account_id, None)
    if session is not None:
        session.close()
