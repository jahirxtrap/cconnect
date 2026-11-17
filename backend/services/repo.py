"""How this backend updates itself: from the git checkout it runs from, or from PyPI."""

import importlib
import subprocess
from importlib.metadata import PackageNotFoundError, version as installed_version
from typing import Optional

import httpx
from packaging.version import InvalidVersion, Version
from sqlalchemy.exc import OperationalError

from core import packages, paths, release, self_update
from services import database_engines, databases, git

_TIMEOUT = 120
_UPGRADE_TIMEOUT = 1800
_RELEASE_TIMEOUT = 10
_RELEASE_URL = "https://pypi.org/pypi/cconnect/json"

DISTRIBUTION = "cconnect"


def released() -> tuple[Optional[str], str]:
    """The newer version on PyPI, empty when there is none, or None and why PyPI gave none."""
    try:
        answer = httpx.get(_RELEASE_URL, timeout=_RELEASE_TIMEOUT)
        answer.raise_for_status()
        latest = str(answer.json()["info"]["version"])
        newer = Version(latest) > Version(release.VERSION)
    except httpx.TimeoutException:
        return None, f"PyPI did not answer within {_RELEASE_TIMEOUT} seconds"
    except httpx.HTTPStatusError as exc:
        return None, f"PyPI answered {exc.response.status_code} {exc.response.reason_phrase}"
    except httpx.HTTPError as exc:
        return None, f"PyPI could not be reached: {str(exc) or type(exc).__name__}"
    except (ValueError, KeyError, InvalidVersion) as exc:
        return None, f"PyPI's answer could not be read: {str(exc) or type(exc).__name__}"
    return (latest if newer else ""), ""


def _kept_packages() -> list[str]:
    try:
        entries = databases.load()
    except OperationalError:
        entries = []
    return database_engines.kept_packages(entries)


def upgrade_command() -> list[str]:
    return packages.upgrade_command(DISTRIBUTION, _kept_packages())


def on_disk() -> str:
    """The version installed in the environment right now."""
    importlib.invalidate_caches()
    try:
        return installed_version(DISTRIBUTION)
    except PackageNotFoundError:
        return release.VERSION


def upgrade_in_place() -> dict:
    """Upgrades the install under its running python and puts back the database drivers uv prunes."""
    kept = _kept_packages()
    before = on_disk()
    try:
        result = packages.run(packages.in_place_upgrade_command(DISTRIBUTION), _UPGRADE_TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        return {**_package_status(), "ok": False, "message": str(exc), "changed": False, "version": before}
    output = (result.stdout + result.stderr).strip()
    try:
        database_engines.install_packages(kept)
    except database_engines.EngineError as exc:
        output = f"{output}\n{exc}".strip()
    after = on_disk()
    return {
        **_package_status(),
        "ok": (result.returncode == 0 or after != before) and set(kept) <= set(_kept_packages()),
        "message": output,
        "changed": after != before,
        "version": after,
    }


def _upgrade_by_supervisor() -> dict:
    self_update.request()
    return {**_package_status(), "ok": True, "message": "", "changed": False, "handover": True}


def upgrade() -> dict:
    if self_update.needed():
        return _upgrade_by_supervisor()
    try:
        result = packages.run(upgrade_command(), _TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        return {**_package_status(), "ok": False, "message": str(exc), "changed": False}
    changed = on_disk() != release.VERSION
    return {
        **_package_status(),
        "ok": result.returncode == 0 or changed,
        "message": (result.stdout + result.stderr).strip(),
        "changed": changed,
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
    }


def check() -> dict:
    if paths.INSTALLED:
        latest, problem = released()
        return {**_package_status(), "latest": latest or "", "ok": latest is not None, "message": problem}
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
