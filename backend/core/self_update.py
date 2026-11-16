import shutil
import subprocess
import sys
from pathlib import Path

import psutil

from core import detached, paths
from core.config import PORT

SHELL = ["powershell", "-NoProfile", "-NonInteractive", "-Command"]
_HOLDERS = (
    "function Holders { Get-Process | Where-Object { $path = $_.Path; "
    "$path -and ($held | Where-Object { $path.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }) } }"
)
_WAIT = "while ($running = Holders) { $running | Wait-Process -ErrorAction SilentlyContinue }"


def needed() -> bool:
    return sys.platform == "win32" and paths.INSTALLED


def updater() -> int | None:
    try:
        shell = psutil.Process(int(paths.UPDATING_FLAG.read_text(encoding="utf-8").strip()))
        if shell.create_time() <= paths.UPDATING_FLAG.stat().st_mtime:
            return shell.pid
    except (OSError, ValueError, psutil.Error):
        pass
    paths.UPDATING_FLAG.unlink(missing_ok=True)
    return None


def pending() -> bool:
    return updater() is not None


def spared() -> list[int]:
    shell = updater()
    return [shell] if shell is not None else []


def restart_command() -> list[str] | None:
    live = detached.runtime()
    if not live:
        return None
    serve = detached.serve_args(live) or ["run", "--port", live.get("PORT") or str(PORT)]
    return [sys.executable, "-m", detached.CLI_MODULE, *serve, "--detach"]


def quoted(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _call(command: list[str]) -> str:
    return "& " + " ".join(quoted(part) for part in command)


def hand_over(upgrade: list[str], restart: list[str] | None) -> None:
    held = [str(Path(sys.prefix)) + "\\"]
    launcher = shutil.which("cconnect")
    if launcher:
        held.append(launcher)
    steps = [
        f"$held = @({', '.join(quoted(path) for path in held)})", _HOLDERS, _WAIT, _call(upgrade),
        f"Remove-Item -LiteralPath {quoted(str(paths.UPDATING_FLAG))} -ErrorAction SilentlyContinue",
    ]
    if restart:
        steps.append(_call(restart))
    command = [*SHELL, "\n".join(steps)]
    flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    with paths.UPDATE_LOG_FILE.open("wb") as log:
        options: dict = {
            "stdin": subprocess.DEVNULL,
            "stdout": log,
            "stderr": subprocess.STDOUT,
            "cwd": str(paths.DATA_DIR),
            "close_fds": True,
        }
        try:
            shell = subprocess.Popen(command, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **options)
        except OSError:
            shell = subprocess.Popen(command, creationflags=flags, **options)
    paths.UPDATING_FLAG.write_text(str(shell.pid), encoding="utf-8")
