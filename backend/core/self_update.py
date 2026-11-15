import shutil
import subprocess
import sys
from pathlib import Path

from core import detached, paths
from core.config import PORT

_SHELL = ["powershell", "-NoProfile", "-NonInteractive", "-Command"]
_HOLDERS = (
    "function Holders { Get-Process | Where-Object { $path = $_.Path; "
    "$path -and ($held | Where-Object { $path.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }) } }"
)
_WAIT = "while ($running = Holders) { $running | Wait-Process -ErrorAction SilentlyContinue }"


def needed() -> bool:
    return sys.platform == "win32" and paths.INSTALLED


def restart_command() -> list[str] | None:
    if detached.running_pid() is None:
        return None
    exposed = detached.provider()
    port = detached.runtime().get("PORT")
    return [
        sys.executable, "-m", detached.CLI_MODULE,
        *(["expose", exposed] if exposed else ["run"]),
        *(["--port", port] if port and int(port) != PORT else []),
        "--detach",
    ]


def _quoted(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _call(command: list[str]) -> str:
    return "& " + " ".join(_quoted(part) for part in command)


def hand_over(upgrade: list[str], restart: list[str] | None) -> None:
    held = [str(Path(sys.prefix)) + "\\"]
    launcher = shutil.which("cconnect")
    if launcher:
        held.append(launcher)
    steps = [f"$held = @({', '.join(_quoted(path) for path in held)})", _HOLDERS, _WAIT, _call(upgrade)]
    if restart:
        steps.append(f"if ($LASTEXITCODE -eq 0) {{ {_call(restart)} }}")
    command = [*_SHELL, "\n".join(steps)]
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
            subprocess.Popen(command, creationflags=flags | subprocess.CREATE_BREAKAWAY_FROM_JOB, **options)
        except OSError:
            subprocess.Popen(command, creationflags=flags, **options)
