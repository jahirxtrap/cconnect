"""Settings the app surfaces but the CLI owns, read and written only in its settings.json."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

_SETTINGS_FILE = "settings.json"

MAX_SAFE_INTEGER = 9007199254740991


@dataclass(frozen=True)
class CliSettingDef:
    json_key: str
    default: Any
    type: type
    description: str
    minimum: Optional[int] = None
    maximum: Optional[int] = None


SETTINGS: dict[str, CliSettingDef] = {
    "retention_days": CliSettingDef(
        json_key="cleanupPeriodDays",
        default=30,
        type=int,
        description="Days a chat is kept before the CLI deletes its transcript",
        minimum=1,
        maximum=MAX_SAFE_INTEGER,
    ),
    "chat_language": CliSettingDef(
        json_key="language",
        default="",
        type=str,
        description="Language Claude replies in, by name; empty follows the conversation",
    ),
    "always_thinking": CliSettingDef(
        json_key="alwaysThinkingEnabled",
        default=False,
        type=bool,
        description="Think before every reply instead of only when the task calls for it",
    ),
    "auto_compact": CliSettingDef(
        json_key="autoCompactEnabled",
        default=True,
        type=bool,
        description="Compact a conversation on its own when it fills the context window",
    ),
    "remote_control": CliSettingDef(
        json_key="remoteControlAtStartup",
        default=None,
        type=bool,
        description="Let a session started here be taken over from claude.ai",
    ),
    "co_authored": CliSettingDef(
        json_key="includeCoAuthoredBy",
        default=None,
        type=bool,
        description="Add the Co-Authored-By trailer to the commits and pull requests Claude writes",
    ),
    "session_upload": CliSettingDef(
        json_key="autoUploadSessions",
        default=None,
        type=bool,
        description="Upload session transcripts to Anthropic",
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


def _valid(value: Any, expected: type) -> bool:
    return isinstance(value, expected) and (expected is bool or not isinstance(value, bool))


def _stored(key: str) -> Any:
    defn = SETTINGS[key]
    value = _read().get(defn.json_key)
    return value if _valid(value, defn.type) else None


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
            "minimum": defn.minimum,
            "maximum": defn.maximum,
        }
        for key, defn in SETTINGS.items()
    }


def set(key: str, value: Any) -> None:
    from services import accounts

    if key not in SETTINGS:
        raise KeyError(key)
    defn = SETTINGS[key]
    blank = value is None or (defn.type is str and value == "")
    if not blank:
        if not _valid(value, defn.type):
            raise ValueError(f"{key} expects {defn.type.__name__}")
        if defn.minimum is not None and value < defn.minimum:
            raise ValueError(f"{key} must be at least {defn.minimum}")
        if defn.maximum is not None and value > defn.maximum:
            raise ValueError(f"{key} must be at most {defn.maximum}")
    data = _read()
    if blank:
        data.pop(defn.json_key, None)
    else:
        data[defn.json_key] = value
    _write(data)
    accounts.sync_all_shared_config()


def reset() -> None:
    for key in SETTINGS:
        set(key, None)
