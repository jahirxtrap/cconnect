import re
from typing import Optional

from core.db import Session
from core.models import DelegateRun
from services.event_rows import rows_of, visible_rows

ID = re.compile(r"^[A-Za-z0-9_-]+$")

_running: dict[tuple[str, str], list[dict]] = {}


def _valid(session_id: str, tool_use_id: str) -> bool:
    return bool(ID.match(session_id or "") and ID.match(tool_use_id or ""))


def follow(session_id: str, tool_use_id: str) -> list[dict]:
    events: list[dict] = []
    if _valid(session_id, tool_use_id):
        _running[(session_id, tool_use_id)] = events
    return events


def running(session_id: str, tool_use_id: str) -> bool:
    return (session_id, tool_use_id) in _running


def stamp(session_id: str) -> tuple:
    """What a session's delegations show: the steps of those still running and the files of those that ended."""
    live = tuple(sorted((tool_use_id, len(events)) for (owner, tool_use_id), events in list(_running.items()) if owner == session_id))
    with Session() as session:
        saved = tuple(sorted(
            (row.tool_use_id, row.saved_at)
            for row in session.query(DelegateRun.tool_use_id, DelegateRun.saved_at).filter(DelegateRun.session_id == session_id)
        ))
    return live, saved


def save(session_id: str, tool_use_id: str) -> None:
    events = _running.pop((session_id, tool_use_id), None)
    if not events or not _valid(session_id, tool_use_id):
        return
    with Session() as session:
        _drop(session, session_id, tool_use_id)
        session.add(DelegateRun(session_id=session_id, tool_use_id=tool_use_id, rows=rows_of(events)))
        session.commit()


def _drop(session, session_id: str, tool_use_id: Optional[str] = None) -> None:
    found = session.query(DelegateRun).filter(DelegateRun.session_id == session_id)
    (found if tool_use_id is None else found.filter(DelegateRun.tool_use_id == tool_use_id)).delete()


def _rows(session_id: str, tool_use_id: str) -> Optional[list]:
    events = _running.get((session_id, tool_use_id))
    if events is not None:
        return rows_of(list(events))
    with Session() as session:
        row = session.get(DelegateRun, (session_id, tool_use_id))
    return row.rows if row is not None else None


def children(session_id: str, tool_use_id: str, vis: dict) -> Optional[list[dict]]:
    rows = _rows(session_id, tool_use_id)
    if not isinstance(rows, list):
        return None
    return visible_rows(rows, vis, tool_use_id)


def forget(session_id: str) -> None:
    for key in [key for key in _running if key[0] == session_id]:
        del _running[key]
    with Session() as session:
        _drop(session, session_id)
        session.commit()
