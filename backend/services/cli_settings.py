"""Settings the app surfaces but the CLI owns, read and written only in its settings.json."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

_SETTINGS_FILE = "settings.json"


@dataclass(frozen=True)
class CliSettingDef:
    json_key: str
    default: Any
    type: type
    description: str
    minimum: Optional[int] = None


SETTINGS: dict[str, CliSettingDef] = {
    "retention_days": CliSettingDef(
        json_key="cleanupPeriodDays",
        default=30,
        type=int,
        description="Days a chat is kept before the CLI deletes its transcript",
        minimum=1,
    ),
}


def json_keys() -> tuple[str, ...]:
    return tuple(defn.json_key for defn in SETTINGS.values())


def _path() -> Path:
    from services import accounts

    return accounts.primary_dir() / _SETTINGS_FILE


def _read() -> dict:
    try:
        data = json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _write(data: dict) -> None:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    staged = path.with_name(f".{_SETTINGS_FILE}.writing")
    try:
        staged.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.replace(staged, path)
    except BaseException:
        staged.unlink(missing_ok=True)
        raise


def _stored(key: str) -> Any:
    defn = SETTINGS[key]
    value = _read().get(defn.json_key)
    return value if isinstance(value, defn.type) and not isinstance(value, bool) else None


def get(key: str) -> Any:
    if key not in SETTINGS:
        raise KeyError(key)
    stored = _stored(key)
    return SETTINGS[key].default if stored is None else stored


def describe() -> dict[str, dict]:
    return {
        key: {
            "effective": get(key),
            "default": defn.default,
            "configured": _stored(key) is not None,
            "description": defn.description,
        }
        for key, defn in SETTINGS.items()
    }


def set(key: str, value: Any) -> None:
    from services import accounts

    if key not in SETTINGS:
        raise KeyError(key)
    defn = SETTINGS[key]
    if value is not None:
        if not isinstance(value, defn.type) or isinstance(value, bool):
            raise ValueError(f"{key} expects {defn.type.__name__}")
        if defn.minimum is not None and value < defn.minimum:
            raise ValueError(f"{key} must be at least {defn.minimum}")
    data = _read()
    if value is None:
        data.pop(defn.json_key, None)
    else:
        data[defn.json_key] = value
    _write(data)
    accounts.sync_all_shared_config()


def reset() -> None:
    for key in SETTINGS:
        set(key, None)
