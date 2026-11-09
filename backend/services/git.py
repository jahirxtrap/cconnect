"""Every git invocation the backend makes.

Reads run with `--no-optional-locks`: a plain `git status` otherwise rewrites `.git/index`,
which the project watcher reports as a change and answers with another read, forever.
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

_NO_PROMPT = {"GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "", "SSH_ASKPASS": ""}
_READ_ONLY = ("--no-optional-locks",)
_NOT_FOUND = 127

_found: Optional[tuple[str, bool]] = None


def available() -> bool:
    """Whether git is on the PATH, looked up again only when PATH changes."""
    global _found
    search = os.environ.get("PATH", "")
    if _found is None or _found[0] != search:
        _found = (search, shutil.which("git") is not None)
    return _found[1]


def run(root: Path, *args: str, timeout: int, writes: bool = False) -> subprocess.CompletedProcess:
    prefix = () if writes else _READ_ONLY
    command = ["git", *prefix, "-C", str(root), *args]
    try:
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            stdin=subprocess.DEVNULL,
            env={**os.environ, **_NO_PROMPT},
        )
    except FileNotFoundError:
        return subprocess.CompletedProcess(command, _NOT_FOUND, "", "git is not installed")


def names(listed: Optional[str]) -> list[str]:
    """Paths from a `-z` listing, which git leaves unquoted whatever characters they hold."""
    return [name for name in (listed or "").split("\0") if name]
