import json
import re
import shutil
from pathlib import Path
from typing import Optional

from core import paths

ID = re.compile(r"^[A-Za-z0-9_-]+$")
VISIBLE_ROWS = ("tool_use", "thinking", "file_change")

_running: dict[tuple[str, str], list[dict]] = {}


def _folder(session_id: str) -> Optional[Path]:
    return paths.DELEGATE_RUNS_DIR / session_id if ID.match(session_id or "") else None


def _file(session_id: str, tool_use_id: str) -> Optional[Path]:
    folder = _folder(session_id)
    return folder / f"{tool_use_id}.json" if folder is not None and ID.match(tool_use_id or "") else None


def rows_of(events: list[dict]) -> list[dict]:
    rows: list[dict] = []
    tools: dict[str, dict] = {}
    for event in events:
        kind = event.get("type")
        last = rows[-1] if rows else None
        if kind == "assistant_text":
            if last is not None and last["type"] == "text":
                last["text"] += event.get("text") or ""
            else:
                rows.append({"type": "text", "role": "assistant", "text": event.get("text") or ""})
        elif kind == "thinking" and event.get("label"):
            rows.append({"type": "thinking", "label": True})
        elif kind == "thinking":
            if last is not None and last["type"] == "thinking" and "text" in last:
                last["text"] += event.get("text") or ""
            else:
                rows.append({"type": "thinking", "text": event.get("text") or ""})
        elif kind == "tool_use":
            row = {"type": "tool_use", "name": event.get("name"), "text": event.get("input") or "", "id": event.get("id")}
            tools[str(event.get("id"))] = row
            rows.append(row)
        elif kind == "tool_result" and event.get("content"):
            row = tools.get(str(event.get("tool_use_id")))
            if row is not None:
                row["result"] = event["content"]
        elif kind == "file_change":
            rows.append({key: value for key, value in event.items() if key != "parent"})
    for row in rows:
        if "text" in row and row["type"] in ("text", "thinking"):
            row["text"] = row["text"].strip()
    return [row for row in rows if row["type"] not in ("text", "thinking") or row.get("label") or row["text"]]


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
    out: list[dict] = []
    for row in rows:
        kind = row.get("type")
        mode = vis.get(kind, "full") if kind in VISIBLE_ROWS else "full"
        if mode == "off":
            continue
        if mode == "label":
            row = {"type": "thinking", "label": True} if kind == "thinking" else {
                **{key: value for key, value in row.items() if key not in ("result", "diff_lines")},
                **({"label": True} if kind == "file_change" else {}),
            }
        out.append({**row, "parent": tool_use_id})
    return out


def forget(session_id: str) -> None:
    for key in [key for key in _running if key[0] == session_id]:
        del _running[key]
    folder = _folder(session_id)
    if folder is not None:
        shutil.rmtree(folder, ignore_errors=True)
