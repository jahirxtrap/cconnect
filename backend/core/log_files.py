"""The size every log file keeps to."""

import os
import sys
from pathlib import Path
from typing import BinaryIO

if sys.platform == "win32":
    import _winapi
    import msvcrt

LIMIT = 10 * 1024 * 1024
_FILE_APPEND_DATA = 0x0004
_FILE_READ_ATTRIBUTES = 0x0080
_SYNCHRONIZE = 0x0010_0000
_SHARE_ALL = 0x0007
_OPEN_ALWAYS = 4


def append_only(path: Path) -> BinaryIO:
    if sys.platform != "win32":
        return path.open("ab")
    handle = _winapi.CreateFile(
        str(path), _FILE_APPEND_DATA | _FILE_READ_ATTRIBUTES | _SYNCHRONIZE, _SHARE_ALL, 0, _OPEN_ALWAYS, 0, 0,
    )
    return os.fdopen(msvcrt.open_osfhandle(handle, os.O_APPEND | os.O_BINARY), "ab")


def fits(path: Path, extra: int = 0) -> bool:
    try:
        return path.stat().st_size + extra <= LIMIT
    except OSError:
        return True


def tail(path: Path) -> bytes:
    with path.open("rb") as log:
        log.seek(max(0, log.seek(0, os.SEEK_END) - LIMIT))
        return log.read(LIMIT)


def trim(path: Path) -> None:
    if not fits(path):
        path.write_bytes(tail(path))
