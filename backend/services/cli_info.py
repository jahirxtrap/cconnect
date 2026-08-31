"""Cached snapshot of what the running CLI reports at handshake."""

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Optional

from loguru import logger

from core import cli_manager
from core.config import COMMANDS, DEFAULT_CWD, ULTRACODE_EFFORT

_TTL_SECONDS = 300
_WINDOWS_FILE = Path(__file__).resolve().parent.parent / "context_windows.json"

_snapshot: dict[str, Any] = {}
_fetched_at: float = 0.0
_fetched_for: Optional[str] = None
_windows: dict[str, int] = {}
_warm_task: Optional[asyncio.Task] = None


def load_windows() -> None:
    """Read the cached context windows for the active CLI version."""
    try:
        stored = json.loads(_WINDOWS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    cached = stored.get(cli_manager.active_version() or "") if isinstance(stored, dict) else None
    if isinstance(cached, dict):
        _windows.update({k: v for k, v in cached.items() if isinstance(v, int)})


def _save_windows() -> None:
    try:
        _WINDOWS_FILE.write_text(
            json.dumps({cli_manager.active_version() or "": _windows}, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        logger.warning("could not persist context windows")


def _options(model: Optional[str] = None):
    from claude_agent_sdk import ClaudeAgentOptions

    from services import accounts

    return ClaudeAgentOptions(
        cwd=DEFAULT_CWD,
        cli_path=cli_manager.resolve_cli_path(),
        model=model,
        setting_sources=["user", "project"],
        env=accounts.env_for(accounts.default_account()),
        max_turns=1,
    )


async def _fetch() -> dict[str, Any]:
    from claude_agent_sdk import ClaudeSDKClient

    async with ClaudeSDKClient(_options()) as client:
        return await client.get_server_info() or {}


async def _fetch_window(model: str) -> Optional[int]:
    from claude_agent_sdk import ClaudeSDKClient

    async with ClaudeSDKClient(_options(None if model == "default" else model)) as client:
        usage = await client.get_context_usage()
    size = usage.get("maxTokens")
    return size if isinstance(size, int) and size > 0 else None


async def warm_windows(listed: list[dict]) -> None:
    """Probe and cache the context window of every model not already known."""
    async def load(model: str) -> None:
        try:
            size = await _fetch_window(model)
        except Exception as exc:
            logger.warning(f"context window for {model} unavailable: {type(exc).__name__}: {exc}")
            return
        if size:
            _windows[model] = size

    missing = [entry["id"] for entry in listed if entry["id"] not in _windows]
    if not missing:
        return
    await asyncio.gather(*(load(model) for model in missing))
    _save_windows()


async def server_info(refresh: bool = False) -> dict[str, Any]:
    global _snapshot, _fetched_at, _fetched_for
    from services import accounts

    account = accounts.default_account()
    fresh = _snapshot and _fetched_for == account and time.monotonic() - _fetched_at < _TTL_SECONDS
    if not refresh and fresh:
        return _snapshot
    try:
        _snapshot = await _fetch()
        _fetched_at = time.monotonic()
        _fetched_for = account
    except Exception as exc:
        logger.warning(f"CLI server info unavailable: {type(exc).__name__}: {exc}")
    return _snapshot


async def refresh() -> None:
    """Prime the snapshot, probing unknown context windows in the background."""
    global _warm_task
    load_windows()
    info = await server_info()
    _warm_task = asyncio.create_task(warm_windows(models(info)))


def invalidate() -> None:
    global _snapshot, _fetched_at
    _snapshot = {}
    _fetched_at = 0.0
    _windows.clear()
    load_windows()


def _entries(info: dict[str, Any]) -> list[dict]:
    listed = info.get("models")
    return [entry for entry in listed if isinstance(entry, dict) and entry.get("value")] if isinstance(listed, list) else []


def _levels(entry: dict) -> list[str]:
    if not entry.get("supportsEffort"):
        return []
    raw = entry.get("supportedEffortLevels")
    levels = [level for level in raw if isinstance(level, str)] if isinstance(raw, list) else []
    if not levels:
        return []
    return ["default", *levels, *([ULTRACODE_EFFORT] if "xhigh" in levels else [])]


def models(info: dict[str, Any]) -> list[dict]:
    """The CLI's model lineup in the capabilities shape."""
    return [
        {
            "id": entry["value"],
            "label": entry.get("displayName") or entry["value"],
            "description": entry.get("description") or "",
            "resolved_model": entry.get("resolvedModel") or "",
            "effort_levels": _levels(entry),
            "context_window": _windows.get(entry["value"]),
            "fast_mode": bool(entry.get("supportsFastMode")),
            "auto_mode": bool(entry.get("supportsAutoMode")),
        }
        for entry in _entries(info)
    ]


def _cli_commands(info: dict[str, Any]) -> dict[str, dict]:
    listed = info.get("commands")
    if not isinstance(listed, list):
        return {}
    return {c["name"]: c for c in listed if isinstance(c, dict) and c.get("name")}


def _aliases(entry: dict) -> list[str]:
    raw = entry.get("aliases")
    return [a for a in raw if isinstance(a, str) and a] if isinstance(raw, list) else []


def commands(info: dict[str, Any]) -> list[dict]:
    """CConnect's own commands first, then everything else the CLI reports."""
    reported = _cli_commands(info)
    listed = []
    for own in COMMANDS:
        entry = reported.pop(own["name"], {})
        listed.append({
            "name": own["name"],
            "description": own["description"] if own.get("own_description") else (
                entry.get("description") or own["description"]
            ),
            "kind": own["kind"],
            "require_confirmation": bool(own.get("require_confirmation")),
            "argument_hint": (entry.get("argumentHint") or "") if own["kind"] == "prompt" else "",
            "aliases": _aliases(entry),
        })
    for name, entry in reported.items():
        listed.append({
            "name": name,
            "description": entry.get("description") or "",
            "kind": "prompt",
            "require_confirmation": False,
            "argument_hint": entry.get("argumentHint") or "",
            "aliases": _aliases(entry),
        })
    return listed


def fast_mode(info: dict[str, Any]) -> dict[str, Any]:
    """Whether the CLI can serve fast mode for the server's own account and model."""
    reason = info.get("fast_mode_disabled_reason")
    return {
        "state": info.get("fast_mode_state") or "off",
        "disabled_reason": reason if isinstance(reason, str) and reason else None,
    }


def output_styles(info: dict[str, Any]) -> list[str]:
    styles = info.get("available_output_styles")
    return [style for style in styles if isinstance(style, str)] if isinstance(styles, list) else []


def takes_effort(info: dict[str, Any], model: Optional[str]) -> bool:
    """Whether the CLI lists this model as accepting an effort level."""
    for entry in _entries(info):
        if entry["value"] == (model or "default"):
            return bool(_levels(entry))
    return True
