"""Last task list per session.

The SDK streams TodoWrite only while the turn runs and the transcript keeps no
record of it, so a chat reopened after the turn ended has nothing to show. The
list is remembered here as it is emitted and replayed when the session resumes.
"""

from core.db import Session
from core.models import SessionTodos

_MAX_SESSIONS = 50


def remember(session_id: str | None, items: list[dict]) -> None:
    if not session_id:
        return
    with Session() as session:
        row = session.get(SessionTodos, session_id)
        if not items:
            if row is not None:
                session.delete(row)
        elif row is None:
            session.add(SessionTodos(session_id=session_id, items=items))
        else:
            row.items = items
        session.flush()
        stale = session.query(SessionTodos.session_id).order_by(SessionTodos.updated_at.desc()).offset(_MAX_SESSIONS)
        session.query(SessionTodos).filter(SessionTodos.session_id.in_(stale.scalar_subquery())).delete(synchronize_session=False)
        session.commit()


def load(session_id: str | None) -> list[dict]:
    """Empty once every task is done: nothing left to resume."""
    if not session_id:
        return []
    with Session() as session:
        row = session.get(SessionTodos, session_id)
    items = row.items if row is not None else []
    if items and all(item.get("status") == "completed" for item in items):
        return []
    return items


def forget(session_id: str | None) -> None:
    if not session_id:
        return
    with Session() as session:
        session.query(SessionTodos).filter(SessionTodos.session_id == session_id).delete()
        session.commit()
