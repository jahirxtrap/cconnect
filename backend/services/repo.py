"""How this backend updates itself: from the git checkout it runs from, or from PyPI."""

import subprocess
import sys
from importlib.metadata import PackageNotFoundError, version as installed_version

import httpx

from core import packages, paths, release
from services import git

_TIMEOUT = 120
_RELEASE_TIMEOUT = 10
_RELEASE_URL = "https://pypi.org/pypi/cconnect/json"

DISTRIBUTION = "cconnect"
RELOADS = sys.platform != "win32"


def _parts(version: str) -> tuple[int, ...]:
    return tuple(int(piece) for piece in version.split(".") if piece.isdigit())


def _released() -> str:
    """The version on PyPI, empty unless it is newer than the one running."""
    try:
        answer = httpx.get(_RELEASE_URL, timeout=_RELEASE_TIMEOUT)
        latest = str(answer.json()["info"]["version"]) if answer.status_code == 200 else ""
    except (httpx.HTTPError, ValueError, KeyError):
        return ""
    return latest if _parts(latest) > _parts(release.VERSION) else ""


def upgrade_command() -> list[str]:
    return packages.upgrade_command(DISTRIBUTION)


def _on_disk() -> str:
    """The version installed in the environment right now."""
    try:
        return installed_version(DISTRIBUTION)
    except PackageNotFoundError:
        return release.VERSION


def upgrade() -> dict:
    """Replaces the installed package with the newest release."""
    before = _on_disk()
    try:
        result = packages.run(upgrade_command(), _TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        return {**_package_status(), "ok": False, "message": str(exc), "changed": False}
    return {
        **_package_status(),
        "ok": result.returncode == 0,
        "message": (result.stdout + result.stderr).strip(),
        "changed": _on_disk() != before,
    }


def _package_status() -> dict:
    return {
        "source": "package",
        "tracked": False,
        "revision": "",
        "behind": 0,
        "ahead": 0,
        "dirty": False,
        "latest": "",
        "reloads": RELOADS,
    }


def _git(*args: str, writes: bool = False) -> subprocess.CompletedProcess:
    return git.run(paths.BACKEND_DIR, *args, timeout=_TIMEOUT, writes=writes)


def revision() -> str:
    try:
        result = _git("rev-parse", "--short", "HEAD")
    except (OSError, subprocess.SubprocessError):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def _count(spec: str) -> int:
    """Commits in the range, from the local refs alone: no network involved."""
    try:
        result = _git("rev-list", "--count", spec)
    except (OSError, subprocess.SubprocessError):
        return 0
    return int(result.stdout.strip() or 0) if result.returncode == 0 else 0


def dirty() -> bool:
    try:
        result = _git("status", "--porcelain")
    except (OSError, subprocess.SubprocessError):
        return False
    return result.returncode == 0 and bool(result.stdout.strip())


def status() -> dict:
    if paths.INSTALLED:
        return _package_status()
    current = revision()
    return {
        "source": "checkout",
        "tracked": bool(current),
        "revision": current,
        "behind": _count("HEAD..@{u}") if current else 0,
        "ahead": _count("@{u}..HEAD") if current else 0,
        "dirty": dirty() if current else False,
        "latest": "",
        "reloads": RELOADS,
    }


def check() -> dict:
    if paths.INSTALLED:
        return {**_package_status(), "latest": _released(), "ok": True, "message": ""}
    if not revision():
        return status()
    try:
        result = _git("fetch", "--quiet", writes=True)
    except (OSError, subprocess.SubprocessError) as exc:
        return {**status(), "ok": False, "message": str(exc)}
    return {
        **status(),
        "ok": result.returncode == 0,
        "message": (result.stdout + result.stderr).strip(),
    }


def pull() -> dict:
    if paths.INSTALLED:
        return upgrade()
    before = revision()
    if not before:
        return {**status(), "ok": False, "message": "", "changed": False}
    try:
        result = _git("pull", "--rebase", writes=True)
    except (OSError, subprocess.SubprocessError) as exc:
        return {**status(), "ok": False, "message": str(exc), "changed": False}
    return {
        **status(),
        "ok": result.returncode == 0,
        "message": (result.stdout + result.stderr).strip(),
        "changed": revision() != before,
    }
