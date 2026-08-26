"""Project metadata: the display name, and the projects the user registered by path.

The transcripts on disk stay the source of truth for which projects hold chats — this table
only adds what disk cannot say: a name of the user's choosing, and a project that exists
before its first chat does. `chat_list` merges both when it publishes the list.
"""

from typing import Optional

from core.db import Session
from core.models import ProjectMeta
from services import sessions as sessions_service


def _dict(row: ProjectMeta) -> dict:
    return {"project_key": row.project_key, "path": row.path, "name": row.name}


def snapshot() -> dict[str, dict]:
    with Session() as s:
        return {row.project_key: _dict(row) for row in s.query(ProjectMeta).all()}


def register(path: str, name: Optional[str] = None) -> dict:
    """Add a project by its working directory, so it lists before holding any chat."""
    clean = (path or "").strip().rstrip("/\\")
    if not clean:
        raise ValueError("path is required")
    key = sessions_service.project_key_for(clean)
    label = (name or "").strip() or None
    with Session() as s:
        row = s.get(ProjectMeta, key)
        if row is None:
            row = ProjectMeta(project_key=key, path=clean, name=label)
            s.add(row)
        else:
            row.path = clean
            if label:
                row.name = label
        s.commit()
        return _dict(row)


def rename(project_key: str, name: str, path: Optional[str] = None) -> Optional[dict]:
    """Set the display name; an empty one clears it, back to the folder's own name.
    `path` seeds the row for a project that so far only exists on disk."""
    clean = (name or "").strip() or None
    with Session() as s:
        row = s.get(ProjectMeta, project_key)
        if row is None:
            if not path:
                return None
            row = ProjectMeta(project_key=project_key, path=path, name=clean)
            s.add(row)
        else:
            row.name = clean
        s.commit()
        return _dict(row)


def forget(project_key: str) -> bool:
    with Session() as s:
        row = s.get(ProjectMeta, project_key)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True
