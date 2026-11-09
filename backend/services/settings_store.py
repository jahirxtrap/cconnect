"""In-memory-cached access to backend settings. Reads never touch the DB or the event loop.

The DB keeps one row per registry setting (key, value, description) so the table is
self-documenting; `value` is NULL until overridden, and the effective value is
`override ?? code default`. Descriptions are synced from the registry on every startup."""

from typing import Any

from core.db import Session
from core.models import Setting
from core.settings_defs import SETTINGS

_overrides: dict[str, Any] = {}


def _encode(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _decode(raw: str, typ: type) -> Any:
    if typ is bool:
        return raw == "true"
    if typ is int:
        return int(raw)
    return raw


def load() -> None:
    """Sync a row per registry setting (seeding/refreshing descriptions), then cache the
    configured overrides. Called once at startup, after init_db()."""
    _overrides.clear()
    with Session() as s:
        for key, defn in SETTINGS.items():
            row = s.get(Setting, key)
            if row is None:
                s.add(Setting(key=key, value=None, description=defn.description))
            elif row.description != defn.description:
                row.description = defn.description
        s.commit()
        for row in s.query(Setting).all():
            if row.key in SETTINGS and row.value is not None:
                _overrides[row.key] = _decode(row.value, SETTINGS[row.key].type)


def get(key: str) -> Any:
    """Effective value: the stored override, or the code-defined default."""
    if key not in SETTINGS:
        raise KeyError(key)
    return _overrides[key] if key in _overrides else SETTINGS[key].default


_VISIBILITY = {
    "thinking": "show_thinking",
    "tool_use": "show_tool_use",
    "file_change": "show_file_change",
    "hooks": "show_hooks",
    "compact": "show_compact",
}


def visibility_mode(item_type: str) -> str:
    key = _VISIBILITY.get(item_type)
    return get(key) if key else "full"


def all_effective() -> dict[str, Any]:
    return {key: get(key) for key in SETTINGS}


def describe() -> dict[str, dict]:
    """Per-key {effective, default, configured, description} for the app to render."""
    return {
        key: {
            "effective": get(key),
            "default": defn.default,
            "configured": key in _overrides,
            "description": defn.description,
        }
        for key, defn in SETTINGS.items()
    }


def set(key: str, value: Any) -> None:
    if key not in SETTINGS:
        raise KeyError(key)
    defn = SETTINGS[key]
    if value is not None:
        if not isinstance(value, defn.type):
            raise ValueError(f"{key} expects {defn.type.__name__}")
        if defn.allowed is not None and value not in defn.allowed:
            raise ValueError(f"{key} must be one of {defn.allowed}")
    encoded = _encode(value)
    with Session() as s:
        row = s.get(Setting, key)
        if row is None:
            s.add(Setting(key=key, value=encoded, description=defn.description))
        else:
            row.value = encoded
        s.commit()
    if value is None:
        _overrides.pop(key, None)
    else:
        _overrides[key] = value


def reset() -> None:
    """Clear every override (value -> NULL); effective values fall back to code defaults.
    Rows and their descriptions are kept so the table stays self-documenting."""
    with Session() as s:
        for row in s.query(Setting).all():
            row.value = None
        s.commit()
    _overrides.clear()
