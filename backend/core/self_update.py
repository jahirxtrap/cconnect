import os
import sys

import psutil

from core import paths
from core.config import SUPERVISOR_VAR

SHELL = ["powershell", "-NoProfile", "-NonInteractive", "-Command"]


def needed() -> bool:
    return sys.platform == "win32" and paths.INSTALLED


def request(supervisor: int | str | None = None) -> None:
    """Asks the server's supervisor to update the install in place before it starts the server again."""
    paths.UPGRADE_FLAG.write_text(str(supervisor or os.environ.get(SUPERVISOR_VAR, "")), encoding="utf-8")


def upgrading() -> bool:
    try:
        return psutil.pid_exists(int(paths.UPGRADE_FLAG.read_text(encoding="utf-8").strip()))
    except (OSError, ValueError):
        return False


def quoted(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"
