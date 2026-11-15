"""What the running server and a detached launcher left on disk, read by the command and by the update."""

from contextlib import suppress

import psutil

from core import paths

CLI_MODULE = "core.cli"


def runtime() -> dict[str, str]:
    """What the running server recorded, empty when the pid it wrote is gone."""
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
    """PID of a live detached launcher, or None when the recorded one is gone."""
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
    """The provider the detached run exposed with."""
    with suppress(OSError):
        return paths.DETACHED_PROVIDER_FILE.read_text(encoding="utf-8").strip()
    return ""
