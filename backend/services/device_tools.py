"""adb and scrcpy's server on the machine running the backend: the system's adb when it has one, else the copies downloaded here."""

import hashlib
import io
import json
import os
import shutil
import stat
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path
from typing import Optional

from core import paths

MISSING = "tools"
DOWNLOAD_FAILED = "install"

ADB = "adb"
SCRCPY = "scrcpy"

_SDK_VARIABLES = ("ANDROID_HOME", "ANDROID_SDK_ROOT")
_PLATFORM_TOOLS = "platform-tools"
_EMULATOR = "emulator"
_WINDOWS = sys.platform == "win32"
_MACOS = sys.platform == "darwin"
_SUFFIX = ".exe" if _WINDOWS else ""
_DOWNLOAD_TIMEOUT = 300
_EXECUTABLE_BITS = stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH


class ToolsError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


CATALOG = json.loads(paths.DEVICE_TOOLS_FILE.read_text(encoding="utf-8"))
_ADB_ARCHIVE: Optional[dict] = CATALOG[ADB]["archives"].get(sys.platform)
_SERVER_FILE = paths.ANDROID_TOOLS_DIR / f"scrcpy-server-v{CATALOG[SCRCPY]['version']}"


def _sdk_homes() -> list[Path]:
    homes = [Path(os.environ[name]) for name in _SDK_VARIABLES if os.environ.get(name)]
    if _WINDOWS:
        homes.append(Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local") / "Android" / "Sdk")
    elif _MACOS:
        homes.append(Path.home() / "Library" / "Android" / "sdk")
    else:
        homes.append(Path.home() / "Android" / "Sdk")
    return homes


def sdk_root() -> Optional[Path]:
    return next((home for home in _sdk_homes() if home.is_dir()), None)


def _downloaded_adb() -> Optional[Path]:
    if _ADB_ARCHIVE is None:
        return None
    return paths.ANDROID_TOOLS_DIR / CATALOG[ADB]["folder"] / _ADB_ARCHIVE["executable"]


def adb_path() -> Optional[str]:
    found = shutil.which(ADB)
    if found:
        return found
    for home in _sdk_homes():
        candidate = home / _PLATFORM_TOOLS / f"{ADB}{_SUFFIX}"
        if candidate.is_file():
            return str(candidate)
    own = _downloaded_adb()
    return str(own) if own is not None and own.is_file() else None


def scrcpy_server() -> Optional[Path]:
    return _SERVER_FILE if _SERVER_FILE.is_file() else None


def scrcpy_version() -> str:
    return CATALOG[SCRCPY]["version"]


def emulator_path() -> Optional[str]:
    root = sdk_root()
    candidate = root / _EMULATOR / f"{_EMULATOR}{_SUFFIX}" if root else None
    return str(candidate) if candidate and candidate.is_file() else None


def missing() -> list[str]:
    return [name for name, present in ((ADB, adb_path()), (SCRCPY, scrcpy_server())) if not present]


def download_size() -> int:
    wanted = missing()
    total = CATALOG[SCRCPY]["size"] if SCRCPY in wanted else 0
    if ADB in wanted and _ADB_ARCHIVE is not None:
        total += _ADB_ARCHIVE["size"]
    return total


def status() -> dict:
    return {
        "adb": adb_path() is not None,
        "scrcpy": scrcpy_server() is not None,
        "emulator": emulator_path() is not None,
        "missing": missing(),
        "download": download_size(),
    }


def _fetch(url: str, sha256: str) -> bytes:
    with urllib.request.urlopen(url, timeout=_DOWNLOAD_TIMEOUT) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != sha256:
        raise ToolsError(DOWNLOAD_FAILED, f"{url} does not match its checksum")
    return data


def _install_adb() -> None:
    if _ADB_ARCHIVE is None:
        raise ToolsError(DOWNLOAD_FAILED, f"no adb build for {sys.platform}")
    data = _fetch(_ADB_ARCHIVE["url"], _ADB_ARCHIVE["sha256"])
    paths.ANDROID_TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        archive.extractall(paths.ANDROID_TOOLS_DIR)
    executable = _downloaded_adb()
    if executable is not None and not _WINDOWS:
        executable.chmod(executable.stat().st_mode | _EXECUTABLE_BITS)


def _install_scrcpy() -> None:
    data = _fetch(CATALOG[SCRCPY]["url"], CATALOG[SCRCPY]["sha256"])
    paths.ANDROID_TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    _SERVER_FILE.write_bytes(data)


def install() -> None:
    try:
        if adb_path() is None:
            _install_adb()
        if scrcpy_server() is None:
            _install_scrcpy()
    except (urllib.error.URLError, OSError, zipfile.BadZipFile) as exc:
        raise ToolsError(DOWNLOAD_FAILED, str(exc)) from exc
