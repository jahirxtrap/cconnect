from contextlib import suppress

import psutil

from core import paths

CLI_MODULE = "core.cli"


def recorded_process(pid: int) -> psutil.Process | None:
    with suppress(psutil.Error, OSError):
        process = psutil.Process(pid)
        if process.create_time() <= paths.RUNTIME_FILE.stat().st_mtime:
            return process
    return None


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
    return recorded if pid and recorded_process(pid) else {}


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
