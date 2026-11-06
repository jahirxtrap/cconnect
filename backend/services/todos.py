"""Last task list per session.

The SDK streams TodoWrite only while the turn runs and the transcript keeps no
record of it, so a chat reopened after the turn ended has nothing to show. The
list is remembered here as it is emitted and replayed when the session resumes.
"""

import json

from loguru import logger

from core import paths
from services import files

_MAX_SESSIONS = 50

_todos: dict[str, list[dict]] | None = None


def _load() -> dict[str, list[dict]]:
    global _todos
    if _todos is None:
        try:
            data = json.loads(paths.TODOS_FILE.read_text(encoding="utf-8"))
            _todos = {k: v for k, v in data.items() if isinstance(v, list)} if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            _todos = {}
    return _todos


def _save() -> None:
    try:
        files.write_json(paths.TODOS_FILE, _load())
    except OSError:
        logger.warning("could not persist session todos")


def remember(session_id: str | None, items: list[dict]) -> None:
    if not session_id:
        return
    store = _load()
    store.pop(session_id, None)
    if items:
        store[session_id] = items
    for stale in list(store)[:-_MAX_SESSIONS]:
        store.pop(stale, None)
    _save()


def load(session_id: str | None) -> list[dict]:
    """Empty once every task is done: nothing left to resume."""
    if not session_id:
        return []
    items = _load().get(session_id, [])
    if items and all(item.get("status") == "completed" for item in items):
        return []
    return items


def forget(session_id: str | None) -> None:
    if not session_id or session_id not in _load():
        return
    _load().pop(session_id, None)
    _save()
