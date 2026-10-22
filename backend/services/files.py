"""Path safety and the entry shape every file listing in the API answers with."""

import json
import os
from pathlib import Path


def resolve(base: Path, relpath: str) -> Path:
    root = base.resolve()
    target = (root / relpath).resolve()
    if target != root and root not in target.parents:
        raise ValueError("path escapes the root")
    return target


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(f".{path.name}.writing")
    try:
        staged.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(staged, path)
    except BaseException:
        staged.unlink(missing_ok=True)
        raise


def count_children(path: Path) -> int:
    try:
        return sum(1 for child in path.iterdir() if not child.name.startswith("."))
    except OSError:
        return 0


def entry(path: Path, stat: os.stat_result, is_dir: bool, name: str = "") -> dict:
    return {
        "name": name or path.name,
        "is_dir": is_dir,
        "size": 0 if is_dir else stat.st_size,
        "modified": stat.st_mtime,
        "items": count_children(path) if is_dir else 0,
    }
