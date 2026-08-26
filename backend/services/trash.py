"""Deleted chats kept aside instead of removed, when the `trash_enabled` setting says so.

The transcript is *moved* to `<projects dir>/.trash/<project key>/`, not flagged: the chat list
scans the projects directory, so moving the file takes the chat out of every list without
teaching the scanner about deleted state, and restoring is the same move backwards. Nothing here
expires — the trash only empties when the user says so.
"""

import shutil
import time
from pathlib import Path
from typing import Optional

from core.config import CLAUDE_PROJECTS_DIR
from core.db import Session
from core.models import TrashedSession

TRASH_DIR = ".trash"


def _trash_root() -> Path:
    return Path(CLAUDE_PROJECTS_DIR) / TRASH_DIR


def enabled() -> bool:
    from services import settings_store
    return bool(settings_store.get("trash_enabled"))


def _dict(row: TrashedSession) -> dict:
    return {
        "session_id": row.session_id,
        "project_key": row.project_key,
        "title": row.title,
        "path": row.path,
        "deleted_at": row.deleted_at,
    }


def snapshot() -> list[dict]:
    with Session() as s:
        rows = s.query(TrashedSession).all()
        return [_dict(row) for row in sorted(rows, key=lambda item: item.deleted_at, reverse=True)]


def store(
    project_key: str,
    session_id: str,
    file: Path,
    title: Optional[str],
    path: Optional[str],
    category_id: Optional[str] = None,
    position: Optional[float] = None,
) -> bool:
    """Move a transcript (and its sibling folder) into the trash and remember where it came from."""
    target_dir = _trash_root() / project_key
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / file.name
    if target.exists():
        target.unlink()
    shutil.move(str(file), str(target))
    extras = file.parent / session_id
    if extras.is_dir():
        extras_target = target_dir / session_id
        if extras_target.exists():
            shutil.rmtree(extras_target, ignore_errors=True)
        shutil.move(str(extras), str(extras_target))
    with Session() as s:
        row = s.get(TrashedSession, session_id)
        if row is None:
            row = TrashedSession(session_id=session_id, project_key=project_key, title=title, path=path, deleted_at=time.time())
            s.add(row)
        else:
            row.project_key = project_key
            row.title = title
            row.path = path
            row.deleted_at = time.time()
        row.category_id = category_id
        row.position = position
        s.commit()
    return True


def restore(session_id: str) -> Optional[str]:
    """Put a chat back in its project — and in the category it sat in — returning that project key."""
    from services import categories

    with Session() as s:
        row = s.get(TrashedSession, session_id)
        if row is None:
            return None
        project_key = row.project_key
        category_id, position = row.category_id, row.position
        source = _trash_root() / project_key / f"{session_id}.jsonl"
        if source.is_file():
            target_dir = Path(CLAUDE_PROJECTS_DIR) / project_key
            target_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(target_dir / source.name))
            extras = _trash_root() / project_key / session_id
            if extras.is_dir():
                shutil.move(str(extras), str(target_dir / session_id))
        s.delete(row)
        s.commit()
    categories.restore_placement(session_id, category_id, position)
    return project_key


def _erase(session_id: str, project_key: str) -> None:
    directory = _trash_root() / project_key
    (directory / f"{session_id}.jsonl").unlink(missing_ok=True)
    extras = directory / session_id
    if extras.is_dir():
        shutil.rmtree(extras, ignore_errors=True)


def purge(session_id: str) -> bool:
    with Session() as s:
        row = s.get(TrashedSession, session_id)
        if row is None:
            return False
        _erase(session_id, row.project_key)
        s.delete(row)
        s.commit()
        return True


def purge_all() -> int:
    with Session() as s:
        rows = s.query(TrashedSession).all()
        for row in rows:
            _erase(row.session_id, row.project_key)
            s.delete(row)
        s.commit()
        return len(rows)
