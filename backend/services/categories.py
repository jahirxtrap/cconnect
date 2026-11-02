"""Chat categories and their manual order, kept in SQLite."""

import uuid
from typing import Optional

from core.db import Session
from core.models import AgentSessionPlacement, SessionCategory, SessionPlacement

_STEP = 1024.0
_MIN_GAP = 1e-4

Placement = SessionPlacement | AgentSessionPlacement


def _category_dict(row: SessionCategory) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "position": row.position,
        "color": row.color,
        "project_key": row.project_key,
    }


def _placement_dict(row: Placement) -> dict:
    placed = {
        "session_id": row.session_id,
        "category_id": row.category_id,
        "position": row.position,
    }
    if isinstance(row, AgentSessionPlacement):
        placed["agent"] = row.agent
    return placed


def _model(agent: Optional[str]) -> type[Placement]:
    return SessionPlacement if agent is None else AgentSessionPlacement


def _scope(s, agent: Optional[str]):
    query = s.query(_model(agent))
    return query if agent is None else query.filter(AgentSessionPlacement.agent == agent)


def _find(s, session_id: str, agent: Optional[str]) -> Optional[Placement]:
    return s.get(SessionPlacement, session_id) if agent is None else s.get(AgentSessionPlacement, (agent, session_id))


def _created(session_id: str, category_id: Optional[str], position: float, agent: Optional[str]) -> Placement:
    if agent is None:
        return SessionPlacement(session_id=session_id, category_id=category_id, position=position)
    return AgentSessionPlacement(agent=agent, session_id=session_id, category_id=category_id, position=position)


def _between(previous: Optional[float], following: Optional[float]) -> float:
    if previous is None and following is None:
        return 0.0
    if previous is None:
        return following - _STEP
    if following is None:
        return previous + _STEP
    return (previous + following) / 2


def _in_category(s, category_id: Optional[str], agent: Optional[str]) -> list[Placement]:
    column = _model(agent).category_id
    return _scope(s, agent).filter(column.is_(None) if category_id is None else column == category_id).all()


def _positions_in(s, category_id: Optional[str], skip: Optional[str], agent: Optional[str] = None) -> list[float]:
    return sorted(row.position for row in _in_category(s, category_id, agent) if row.session_id != skip)


def _normalize_placements(s, category_id: Optional[str], agent: Optional[str] = None) -> None:
    rows = _in_category(s, category_id, agent)
    for index, row in enumerate(sorted(rows, key=lambda item: item.position)):
        row.position = index * _STEP


def snapshot() -> dict:
    with Session() as s:
        categories = sorted(s.query(SessionCategory).all(), key=lambda row: row.position)
        placement = s.query(SessionPlacement).all()
        agent_placement = s.query(AgentSessionPlacement).all()
        return {
            "categories": [_category_dict(row) for row in categories],
            "placement": [_placement_dict(row) for row in placement],
            "agent_placement": [_placement_dict(row) for row in agent_placement],
        }


def create_category(name: str, color: Optional[str] = None, project_key: Optional[str] = None) -> dict:
    clean = (name or "").strip()
    if not clean:
        raise ValueError("name is required")
    with Session() as s:
        last = max((row.position for row in s.query(SessionCategory).all()), default=-_STEP)
        row = SessionCategory(
            id=uuid.uuid4().hex,
            name=clean,
            position=last + _STEP,
            color=color or None,
            project_key=project_key or None,
        )
        s.add(row)
        s.commit()
        return _category_dict(row)


def update_category(
    category_id: str,
    name: Optional[str] = None,
    color: Optional[str] = None,
    index: Optional[int] = None,
    project_key: Optional[str] = None,
) -> Optional[dict]:
    with Session() as s:
        row = s.get(SessionCategory, category_id)
        if row is None:
            return None
        if name is not None:
            clean = name.strip()
            if not clean:
                raise ValueError("name is required")
            row.name = clean
        if color is not None:
            row.color = color or None
        if project_key is not None:
            row.project_key = project_key or None
        if index is not None:
            others = sorted(
                (item for item in s.query(SessionCategory).all() if item.id != category_id),
                key=lambda item: item.position,
            )
            spot = max(0, min(index, len(others)))
            previous = others[spot - 1].position if spot > 0 else None
            following = others[spot].position if spot < len(others) else None
            row.position = _between(previous, following)
            if previous is not None and following is not None and following - previous < _MIN_GAP:
                for order, item in enumerate(sorted(s.query(SessionCategory).all(), key=lambda entry: entry.position)):
                    item.position = order * _STEP
        s.commit()
        return _category_dict(row)


def delete_category(category_id: str) -> bool:
    with Session() as s:
        row = s.get(SessionCategory, category_id)
        if row is None:
            return False
        for model in (SessionPlacement, AgentSessionPlacement):
            for placement in s.query(model).filter(model.category_id == category_id).all():
                placement.category_id = None
        s.delete(row)
        s.commit()
        return True


def place_session(session_id: str, category_id: Optional[str], index: Optional[int], agent: Optional[str] = None) -> dict:
    if not session_id:
        raise ValueError("session id is required")
    with Session() as s:
        if category_id is not None and s.get(SessionCategory, category_id) is None:
            raise ValueError("unknown category")
        row = _find(s, session_id, agent)
        positions = _positions_in(s, category_id, skip=session_id, agent=agent)
        spot = len(positions) if index is None else max(0, min(index, len(positions)))
        previous = positions[spot - 1] if spot > 0 else None
        following = positions[spot] if spot < len(positions) else None
        position = _between(previous, following)
        if row is None:
            row = _created(session_id, category_id, position, agent)
            s.add(row)
        else:
            row.category_id = category_id
            row.position = position
        if previous is not None and following is not None and following - previous < _MIN_GAP:
            _normalize_placements(s, category_id, agent)
        s.commit()
        return _placement_dict(row)


def seed_order(session_ids: list[str], agent: Optional[str] = None) -> list[dict]:
    """Give every chat without a placement one, following the order it is listed in."""
    if not session_ids:
        return []
    with Session() as s:
        placed = _scope(s, agent).all()
        known = {row.session_id for row in placed}
        missing = [session_id for session_id in session_ids if session_id not in known]
        if not missing:
            return []
        lowest = min((row.position for row in placed), default=0.0)
        created = []
        for offset, session_id in enumerate(reversed(missing), start=1):
            row = _created(session_id, None, lowest - offset * _STEP, agent)
            s.add(row)
            created.append(row)
        s.commit()
        return [_placement_dict(row) for row in created]


def placement_of(session_id: str) -> Optional[dict]:
    with Session() as s:
        row = s.get(SessionPlacement, session_id)
        return _placement_dict(row) if row else None


def restore_placement(session_id: str, category_id: Optional[str], position: Optional[float]) -> Optional[dict]:
    """Put a chat back exactly where it sat, unless its category is gone by now."""
    if category_id is None or position is None:
        return None
    with Session() as s:
        if s.get(SessionCategory, category_id) is None:
            return None
        row = s.get(SessionPlacement, session_id)
        if row is None:
            row = SessionPlacement(session_id=session_id, category_id=category_id, position=position)
            s.add(row)
        else:
            row.category_id = category_id
            row.position = position
        s.commit()
        return _placement_dict(row)


def forget_session(session_id: str, agent: Optional[str] = None) -> bool:
    with Session() as s:
        row = _find(s, session_id, agent)
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def forget_agent(agent: str) -> list[str]:
    with Session() as s:
        rows = _scope(s, agent).all()
        for row in rows:
            s.delete(row)
        if rows:
            s.commit()
        return [row.session_id for row in rows]


def prune(known_session_ids: set[str]) -> list[str]:
    """Drop placements whose transcript is gone; callers must pass a complete scan."""
    if not known_session_ids:
        return []
    with Session() as s:
        stale = [row for row in s.query(SessionPlacement).all() if row.session_id not in known_session_ids]
        for row in stale:
            s.delete(row)
        if stale:
            s.commit()
        return [row.session_id for row in stale]
