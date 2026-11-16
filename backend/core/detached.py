import json
from contextlib import suppress

import psutil

from core import paths

CLI_MODULE = "core.cli"
_SERVE_SUPERVISOR = "supervisor"
_SERVE_ARGS = "args"


def record_serve(supervisor: int, args: list[str]) -> None:
    paths.SERVE_FILE.write_text(json.dumps({_SERVE_SUPERVISOR: supervisor, _SERVE_ARGS: args}), encoding="utf-8")


def serve_args(live: dict[str, str]) -> list[str] | None:
    """The command arguments the running server was started with, when its supervisor recorded them."""
    try:
        recorded = json.loads(paths.SERVE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(recorded, dict) or str(recorded.get(_SERVE_SUPERVISOR)) != live.get("SUPERVISOR"):
        return None
    args = recorded.get(_SERVE_ARGS)
    return [str(arg) for arg in args] if isinstance(args, list) else None


def runtime() -> dict[str, str]:
    try:
        recorded = dict(
            entry.split("=", 1)
            for entry in paths.RUNTIME_FILE.read_text(encoding="utf-8").split()
            if "=" in entry
        )
    except OSError:
        return {}
    pid = int(recorded.get("PID") or 0)
    return recorded if pid and psutil.pid_exists(pid) else {}


def running_pid() -> int | None:
    try:
        pid = int(paths.DETACHED_PID_FILE.read_text(encoding="utf-8").strip())
    except (OSError, ValueError):
        return None
    try:
        process = psutil.Process(pid)
        if CLI_MODULE in " ".join(process.cmdline()):
            return pid
    except (psutil.Error, OSError):
        pass
    paths.DETACHED_PID_FILE.unlink(missing_ok=True)
    return None


def provider() -> str:
    with suppress(OSError):
        return paths.DETACHED_PROVIDER_FILE.read_text(encoding="utf-8").strip()
    return ""
