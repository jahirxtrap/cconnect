"""Updates the backend in place from the git checkout it runs from."""

import os
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
_TIMEOUT = 120
_NO_PROMPT = {"GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "", "SSH_ASKPASS": ""}

RELOADS = sys.platform != "win32"


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(_ROOT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=_TIMEOUT,
        env={**os.environ, **_NO_PROMPT},
    )


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
    current = revision()
    return {
        "tracked": bool(current),
        "revision": current,
        "behind": _count("HEAD..@{u}") if current else 0,
        "ahead": _count("@{u}..HEAD") if current else 0,
        "dirty": dirty() if current else False,
        "reloads": RELOADS,
    }


def check() -> dict:
    if not revision():
        return status()
    try:
        result = _git("fetch", "--quiet")
    except (OSError, subprocess.SubprocessError) as exc:
        return {**status(), "ok": False, "message": str(exc)}
    return {
        **status(),
        "ok": result.returncode == 0,
        "message": (result.stdout + result.stderr).strip(),
    }


def pull() -> dict:
    before = revision()
    if not before:
        return {**status(), "ok": False, "message": "", "changed": False}
    try:
        result = _git("pull", "--rebase")
    except (OSError, subprocess.SubprocessError) as exc:
        return {**status(), "ok": False, "message": str(exc), "changed": False}
    return {
        **status(),
        "ok": result.returncode == 0,
        "message": (result.stdout + result.stderr).strip(),
        "changed": revision() != before,
    }
