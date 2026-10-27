import json
import re
import shutil
from pathlib import Path
from typing import Optional

from core import paths
from services.event_rows import rows_of, visible_rows

ID = re.compile(r"^[A-Za-z0-9_-]+$")

_running: dict[tuple[str, str], list[dict]] = {}


def _folder(session_id: str) -> Optional[Path]:
    return paths.DELEGATE_RUNS_DIR / session_id if ID.match(session_id or "") else None


def _file(session_id: str, tool_use_id: str) -> Optional[Path]:
    folder = _folder(session_id)
    return folder / f"{tool_use_id}.json" if folder is not None and ID.match(tool_use_id or "") else None


def follow(session_id: str, tool_use_id: str) -> list[dict]:
    events: list[dict] = []
    if _file(session_id, tool_use_id) is not None:
        _running[(session_id, tool_use_id)] = events
    return events


def running(session_id: str, tool_use_id: str) -> bool:
    return (session_id, tool_use_id) in _running


def save(session_id: str, tool_use_id: str) -> None:
    events = _running.pop((session_id, tool_use_id), None)
    file = _file(session_id, tool_use_id)
    if events is None or file is None or not events:
        return
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(rows_of(events), ensure_ascii=False), encoding="utf-8")


def _rows(session_id: str, tool_use_id: str) -> Optional[list]:
    events = _running.get((session_id, tool_use_id))
    if events is not None:
        return rows_of(list(events))
    file = _file(session_id, tool_use_id)
    try:
        return json.loads(file.read_text(encoding="utf-8")) if file is not None else None
    except (OSError, ValueError):
        return None


def children(session_id: str, tool_use_id: str, vis: dict) -> Optional[list[dict]]:
    rows = _rows(session_id, tool_use_id)
    if not isinstance(rows, list):
        return None
    return visible_rows(rows, vis, tool_use_id)


def forget(session_id: str) -> None:
    for key in [key for key in _running if key[0] == session_id]:
        del _running[key]
    folder = _folder(session_id)
    if folder is not None:
        shutil.rmtree(folder, ignore_errors=True)
