import shutil
import socket
import subprocess
import threading
from collections import deque
from typing import Optional

from core.packages import NO_WINDOW

SSH_PORT = 22
CONNECT_SECONDS = 10
OPEN_SECONDS = 3 * CONNECT_SECONDS
ALIVE_SECONDS = 30
CLOSE_SECONDS = 5
ERROR_LINES = 6
DEBUG_PREFIX = "debug"

SSH_MISSING = "ssh_missing"
TUNNEL_FAILED = "tunnel"


class TunnelError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class Tunnel:
    def __init__(self, ssh: dict, host: str, port: int):
        self.ssh = ssh
        self.host = host
        self.port = port
        self.local = 0
        self._process: Optional[subprocess.Popen] = None
        self._errors: deque[str] = deque(maxlen=ERROR_LINES)

    @property
    def alive(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def _command(self, client: str) -> list[str]:
        target = f"{self.ssh['user']}@{self.ssh['host']}" if self.ssh.get("user") else self.ssh["host"]
        return [
            client,
            "-N",
            "-v",
            "-o", "BatchMode=yes",
            "-o", "ExitOnForwardFailure=yes",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", f"ConnectTimeout={CONNECT_SECONDS}",
            "-o", f"ServerAliveInterval={ALIVE_SECONDS}",
            "-L", f"127.0.0.1:{self.local}:{self.host}:{self.port}",
            "-p", str(self.ssh.get("port") or SSH_PORT),
            *(["-i", self.ssh["key"]] if self.ssh.get("key") else []),
            target,
        ]

    def _keep(self, line: str) -> None:
        text = line.strip()
        if text and not text.startswith(DEBUG_PREFIX):
            self._errors.append(text)

    def _watch(self, process: subprocess.Popen, ready: str, opened: threading.Event, settled: threading.Event) -> None:
        for line in process.stderr:
            if not settled.is_set() and "listening on" in line and ready in line:
                opened.set()
                settled.set()
            else:
                self._keep(line)
        settled.set()

    def open(self) -> int:
        client = shutil.which("ssh")
        if client is None:
            raise TunnelError(SSH_MISSING)
        self.local = _free_port()
        self._process = subprocess.Popen(
            self._command(client),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=NO_WINDOW,
        )
        opened = threading.Event()
        settled = threading.Event()
        threading.Thread(
            target=self._watch,
            args=(self._process, f"port {self.local}", opened, settled),
            name="db-tunnel",
            daemon=True,
        ).start()
        settled.wait(OPEN_SECONDS)
        if opened.is_set():
            return self.local
        self.close()
        raise TunnelError(TUNNEL_FAILED, "\n".join(self._errors))

    def close(self) -> None:
        process, self._process = self._process, None
        if process is None or process.poll() is not None:
            return
        process.terminate()
        try:
            process.wait(CLOSE_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()
