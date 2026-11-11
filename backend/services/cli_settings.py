"""Settings the app surfaces but the CLI owns, read and written only in its settings.json."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

from services import files

_SETTINGS_FILE = "settings.json"
_ATTRIBUTION = "attribution"
_ATTRIBUTION_PARTS = ("commit", "pr")
_LEGACY_ATTRIBUTION = "includeCoAuthoredBy"

MAX_SAFE_INTEGER = 9007199254740991


@dataclass(frozen=True)
class CliSettingDef:
    json_key: str
    default: Any
    type: type
    description: str
    minimum: Optional[int] = None
    maximum: Optional[int] = None
    unset_by: Any = None
    read: Optional[Callable[[dict], Any]] = None
    write: Optional[Callable[[dict, Any], None]] = None


def _attributed(data: dict) -> Optional[bool]:
    """Whether commits carry the trailer: the CLI hides it with empty commit and pr texts."""
    stored = data.get(_ATTRIBUTION)
    if isinstance(stored, dict):
        return any(stored.get(part) != "" for part in _ATTRIBUTION_PARTS)
    if isinstance(stored, bool):
        return stored
    legacy = data.get(_LEGACY_ATTRIBUTION)
    return legacy if isinstance(legacy, bool) else None


def _attribute(data: dict, enabled: Optional[bool]) -> None:
    stored = data.get(_ATTRIBUTION)
    kept = {key: value for key, value in stored.items() if key not in _ATTRIBUTION_PARTS} if isinstance(stored, dict) else {}
    data.pop(_LEGACY_ATTRIBUTION, None)
    if enabled is False:
        data[_ATTRIBUTION] = {**kept, **dict.fromkeys(_ATTRIBUTION_PARTS, "")}
    elif kept:
        data[_ATTRIBUTION] = kept
    else:
        data.pop(_ATTRIBUTION, None)


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
    "auto_compact_window": CliSettingDef(
        json_key="autoCompactWindow",
        default=None,
        type=int,
        description="Context size, in tokens, at which a conversation compacts; unset follows the model's window",
        minimum=100_000,
        maximum=1_000_000,
    ),
    "remote_control": CliSettingDef(
        json_key="remoteControlAtStartup",
        default=None,
        type=bool,
        description="Let a session started here be taken over from claude.ai",
    ),
    "co_authored": CliSettingDef(
        json_key=_ATTRIBUTION,
        default=True,
        type=bool,
        description="Add the Co-Authored-By trailer to the commits and pull requests Claude writes",
        unset_by=True,
        read=_attributed,
        write=_attribute,
    ),
    "session_upload": CliSettingDef(
        json_key="autoUploadSessions",
        default=None,
        type=bool,
        description="Upload session transcripts to Anthropic",
    ),
    "subagent_effort": CliSettingDef(
        json_key="env.CLAUDE_CODE_SUBAGENT_EFFORT",
        default="",
        type=str,
        description="Effort a subagent runs at when its own definition names none; empty follows the chat's",
    ),
    "block_outside_writes": CliSettingDef(
        json_key="permissions.blockWritesOutsideWorkingDirectories",
        default=False,
        type=bool,
        description="Refuse to create or edit files outside the working directories, in every permission mode",
        unset_by=False,
    ),
}


def lookup(data: dict, key: str) -> Any:
    *parents, leaf = key.split(".")
    for part in parents:
        data = data.get(part)
        if not isinstance(data, dict):
            return None
    return data.get(leaf)


def assign(data: dict, key: str, value: Any) -> None:
    *parents, leaf = key.split(".")
    for part in parents:
        child = data.get(part)
        if not isinstance(child, dict):
            child = data[part] = {}
        data = child
    data[leaf] = value


def discard(data: dict, key: str) -> None:
    *parents, leaf = key.split(".")
    chain = [data]
    for part in parents:
        child = chain[-1].get(part)
        if not isinstance(child, dict):
            return
        chain.append(child)
    chain[-1].pop(leaf, None)
    for depth in range(len(parents), 0, -1):
        if chain[depth]:
            return
        chain[depth - 1].pop(parents[depth - 1], None)


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
    files.write_json(_path(), data)


def _valid(value: Any, expected: type) -> bool:
    return isinstance(value, expected) and (expected is bool or not isinstance(value, bool))


def _stored(key: str) -> Any:
    defn = SETTINGS[key]
    value = defn.read(_read()) if defn.read else lookup(_read(), defn.json_key)
    return value if _valid(value, defn.type) else None


def declared_marketplaces() -> dict[str, dict]:
    declared = _read().get("extraKnownMarketplaces")
    if not isinstance(declared, dict):
        return {}
    return {name: entry for name, entry in declared.items() if isinstance(entry, dict)}


def declare_auto_update(name: str, enabled: bool) -> None:
    data = _read()
    declared = data.get("extraKnownMarketplaces")
    if not isinstance(declared, dict) or not isinstance(declared.get(name), dict):
        return
    declared[name] = {**declared[name], "autoUpdate": enabled}
    _write(data)


def env() -> dict[str, str]:
    declared = _read().get("env")
    return {name: value for name, value in declared.items() if isinstance(value, str)} if isinstance(declared, dict) else {}


def bypass_disabled() -> bool:
    permissions = _read().get("permissions")
    return isinstance(permissions, dict) and permissions.get("disableBypassPermissionsMode") == "disable"


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
    if key not in SETTINGS:
        raise KeyError(key)
    defn = SETTINGS[key]
    blank = value is None or value == defn.unset_by or (defn.type is str and value == "")
    if not blank:
        if not _valid(value, defn.type):
            raise ValueError(f"{key} expects {defn.type.__name__}")
        if defn.minimum is not None and value < defn.minimum:
            raise ValueError(f"{key} must be at least {defn.minimum}")
        if defn.maximum is not None and value > defn.maximum:
            raise ValueError(f"{key} must be at most {defn.maximum}")
    data = _read()
    if defn.write:
        defn.write(data, None if blank else value)
    elif not blank:
        assign(data, defn.json_key, value)
    elif value is None or _valid(lookup(data, defn.json_key), defn.type):
        discard(data, defn.json_key)
    _write(data)


def reset() -> None:
    for key in SETTINGS:
        set(key, None)
