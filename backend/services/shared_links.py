"""References to files outside the shared folder: a sidecar with the real path, never a copy."""

import json
import time
from pathlib import Path
from typing import Optional

SUFFIX = ".ccref"


def is_link(name: str) -> bool:
    return name.endswith(SUFFIX)


def visible_name(name: str) -> str:
    return name[: -len(SUFFIX)] if is_link(name) else name


def link_name(name: str) -> str:
    return f"{name}{SUFFIX}"


def target_of(path: Path) -> Optional[Path]:
    """The file a reference points at, straight from its own text."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    target = data.get("target") if isinstance(data, dict) else None
    return Path(target) if isinstance(target, str) and target.strip() else None


def write(path: Path, target: Path) -> None:
    body = {"target": str(target), "created": int(time.time())}
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
