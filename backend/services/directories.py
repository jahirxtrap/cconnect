"""Read-only directory browsing for the apps' path pickers."""

import os
import string
from pathlib import Path
from typing import Optional


def _roots() -> list[str]:
    if os.name != "nt":
        return ["/"]
    return [f"{letter}:\\" for letter in string.ascii_uppercase if Path(f"{letter}:\\").is_dir()]


def listing(path: Optional[str] = None, files: bool = False) -> dict:
    """What is inside `path` (the home directory when empty), with its parent and the roots."""
    target = Path(path).expanduser() if path else Path.home()
    try:
        target = target.resolve()
    except OSError:
        target = Path.home()
    if not target.is_dir():
        target = Path.home()
    entries: list[dict] = []
    try:
        for entry in os.scandir(target):
            try:
                is_dir = entry.is_dir(follow_symlinks=False)
                if not is_dir and not files:
                    continue
                entries.append({"name": entry.name, "path": str(Path(entry.path)), "is_dir": is_dir})
            except OSError:
                continue
    except (OSError, PermissionError):
        pass
    entries.sort(key=lambda item: (not item["is_dir"], item["name"].lower()))
    parent = str(target.parent) if target.parent != target else None
    return {"path": str(target), "parent": parent, "roots": _roots(), "entries": entries}
