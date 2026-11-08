"""Snapshot of what the CLI reports at handshake, kept per account until the binary or the configuration it reads changes."""

import asyncio
import json
from pathlib import Path
from typing import Any, Optional

from loguru import logger

from core import cli_manager, paths
from core.config import COMMANDS, DEFAULT_CWD, ULTRACODE_EFFORT

_CONFIG_FILES = ("settings.json", "settings.local.json", "plugins/installed_plugins.json")
_CONFIG_FOLDERS = ("commands", "skills", "agents", "output-styles")
_OWN_KEYS = ("models", "account", "fast_mode_state", "fast_mode_disabled_reason")

_snapshots: dict[str, tuple[tuple, dict[str, Any]]] = {}
_reading: dict[str, asyncio.Task] = {}
_shared: tuple[tuple, dict[str, Any]] = ((), {})
_shared_reading: Optional[asyncio.Task] = None
_generation = 0
_windows: dict[str, int] = {}
_warm_tasks: set[asyncio.Task] = set()
_provider_models: dict[str, list[dict]] = {}


def load_windows() -> None:
    """Read the cached context windows for the active CLI version."""
    try:
        stored = json.loads(paths.CONTEXT_WINDOWS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    cached = stored.get(cli_manager.active_version() or "") if isinstance(stored, dict) else None
    if isinstance(cached, dict):
        _windows.update({k: v for k, v in cached.items() if isinstance(v, int)})


def _save_windows() -> None:
    try:
        paths.CONTEXT_WINDOWS_FILE.write_text(
            json.dumps({cli_manager.active_version() or "": _windows}, ensure_ascii=False),
            encoding="utf-8",
        )
    except OSError:
        logger.warning("could not persist context windows")


def _options(account: Optional[str] = None, own: bool = False):
    from claude_agent_sdk import ClaudeAgentOptions

    from services import accounts, cli_settings

    target = account or accounts.default_account()
    login = accounts.env_for(target) if accounts.provider_for(target) else accounts.identity_env(target)
    return ClaudeAgentOptions(
        cwd=DEFAULT_CWD,
        cli_path=cli_manager.resolve_cli_path(),
        setting_sources=[] if own else ["user", "project"],
        strict_mcp_config=True,
        env={**cli_settings.env(), **login} if own else accounts.env_for(target),
        max_turns=1,
    )


async def _server_info(options: Any) -> dict[str, Any]:
    from claude_agent_sdk import ClaudeSDKClient

    async with ClaudeSDKClient(options) as client:
        return await client.get_server_info() or {}


async def _read_shared(stamp: tuple, generation: int) -> dict[str, Any]:
    global _shared
    from services import accounts

    info = await _server_info(_options(account=accounts.PRIMARY_ID))
    if generation == _generation:
        _shared = (stamp, info)
    return info


async def _shared_info(stamp: tuple, fresh: bool) -> dict[str, Any]:
    global _shared_reading
    if not fresh and _shared[1] and _shared[0] == stamp:
        return _shared[1]
    if _shared_reading is None or _shared_reading.done():
        _shared_reading = asyncio.create_task(_read_shared(stamp, _generation))
    return await asyncio.shield(_shared_reading)


async def _fetch(account: str, stamp: tuple, fresh: bool) -> dict[str, Any]:
    await provider_models(account)
    shared, own = await asyncio.gather(
        _shared_info(stamp, fresh),
        _server_info(_options(account=account, own=True)),
        return_exceptions=True,
    )
    if isinstance(shared, BaseException):
        raise shared
    if isinstance(own, BaseException):
        logger.warning(f"CLI info of account {account} unavailable: {type(own).__name__}: {own}")
        return dict(shared)
    return {**shared, **{key: own[key] for key in _OWN_KEYS if key in own}}


def _unknown_windows(listed: list[dict]) -> list[str]:
    return [
        entry["id"] for entry in listed
        if entry["context_window"] is None and entry["id"] not in _windows
    ]


async def warm_windows(listed: list[dict], account: Optional[str] = None) -> None:
    """Probe and cache, through one CLI, the context window of every model not already known."""
    from claude_agent_sdk import ClaudeSDKClient

    missing = _unknown_windows(listed)
    if not missing:
        return
    try:
        async with ClaudeSDKClient(_options(account=account, own=True)) as client:
            for model in missing:
                try:
                    await client.set_model(None if model == "default" else model)
                    size = (await client.get_context_usage()).get("maxTokens")
                except Exception as exc:
                    logger.warning(f"context window for {model} unavailable: {type(exc).__name__}: {exc}")
                    continue
                if isinstance(size, int) and size > 0:
                    _windows[model] = size
    except Exception as exc:
        logger.warning(f"context windows unavailable: {type(exc).__name__}: {exc}")
    _save_windows()


def _schedule_warm(listed: list[dict], account: str) -> None:
    if _warm_tasks or not _unknown_windows(listed):
        return
    task = asyncio.create_task(warm_windows(listed, account))
    _warm_tasks.add(task)
    task.add_done_callback(_warm_tasks.discard)


def _stat(path: Path) -> Optional[tuple[int, int]]:
    try:
        found = path.stat()
    except OSError:
        return None
    return (found.st_mtime_ns, found.st_size)


def _folder_stamp(folder: Path) -> tuple:
    return tuple(sorted((str(path), _stat(path)) for pattern in ("*.md", "*/*.md") for path in folder.glob(pattern)))


def _stamp() -> tuple:
    from services import accounts

    roots = (accounts.primary_dir(), Path(DEFAULT_CWD) / ".claude")
    return (
        cli_manager.cli_stamp(),
        tuple(_stat(root / name) for root in roots for name in _CONFIG_FILES),
        tuple(_folder_stamp(root / name) for root in roots for name in _CONFIG_FOLDERS),
    )


async def _read(target: str, generation: int, fresh: bool) -> dict[str, Any]:
    stamp = await asyncio.to_thread(_stamp)
    try:
        info = await _fetch(target, stamp, fresh)
    except Exception as exc:
        logger.warning(f"CLI server info unavailable: {type(exc).__name__}: {exc}")
        return _snapshots.get(target, ((), {}))[1]
    if generation == _generation:
        _snapshots[target] = (stamp, info)
    _schedule_warm(models(info, target), target)
    return info


def _reread(target: str, fresh: bool = False) -> asyncio.Task:
    task = _reading.get(target)
    if task is None or task.done():
        task = _reading[target] = asyncio.create_task(_read(target, _generation, fresh))
    return task


def _target(account: Optional[str]) -> str:
    from services import accounts

    return accounts.resolve(account) if account else accounts.default_account()


async def server_info(refresh: bool = False, account: Optional[str] = None) -> dict[str, Any]:
    target = _target(account)
    known = _snapshots.get(target)
    if refresh or known is None or known[0] != await asyncio.to_thread(_stamp):
        return await asyncio.shield(_reread(target))
    return known[1]


async def provider_models(account: Optional[str] = None) -> None:
    from services import accounts, providers

    target = _target(account)
    provider = accounts.provider_for(target)
    if provider:
        _provider_models[target] = await providers.models(provider["base_url"], accounts.auth_headers(provider.get("auth") or {}))


def observe_init(account: Optional[str], data: dict) -> None:
    known = _snapshots.get(_target(account))
    if known is not None and "fast_mode_state" in data:
        known[1].update(fast_mode_state=data["fast_mode_state"], fast_mode_disabled_reason=data.get("fast_mode_disabled_reason"))


async def refresh() -> None:
    """Prime the snapshot, probing unknown context windows in the background."""
    load_windows()
    await server_info()


def refresh_later(account: Optional[str] = None, shared: bool = False) -> None:
    _reread(_target(account), shared)


def invalidate() -> None:
    global _generation
    _generation += 1
    _reading.clear()
    _snapshots.clear()
    _provider_models.clear()
    _windows.clear()
    load_windows()


def _snapshot(account: Optional[str]) -> dict[str, Any]:
    return (_snapshots.get(_target(account)) or ((), {}))[1]


def _entries(info: dict[str, Any]) -> list[dict]:
    listed = info.get("models")
    return [entry for entry in listed if isinstance(entry, dict) and entry.get("value")] if isinstance(listed, list) else []


def _supported(entry: dict) -> list[str]:
    raw = entry.get("supportedEffortLevels")
    if not entry.get("supportsEffort") or not isinstance(raw, list):
        return []
    return [level for level in raw if isinstance(level, str)]


def _levels(entry: dict) -> list[str]:
    levels = _supported(entry)
    if not levels:
        return []
    return ["default", *levels, *([ULTRACODE_EFFORT] if "xhigh" in levels else [])]


def subagent_efforts(info: dict[str, Any]) -> list[str]:
    return max((_supported(entry) for entry in _entries(info)), key=len, default=[])


def effort_levels_for(model: Optional[str], account: Optional[str] = None) -> list[str]:
    target = _target(account)
    listed = models(_snapshot(target), target)
    entry = next((item for item in listed if item["id"] == model), None)
    return entry["effort_levels"] if entry else []


def _provider_entry(model: Optional[str], account: Optional[str] = None) -> Optional[dict]:
    listed = _provider_models.get(_target(account))
    return next((item for item in listed or [] if item["id"] == model), None) if model else None


def provider_window(model: Optional[str], account: Optional[str] = None) -> Optional[int]:
    entry = _provider_entry(model, account)
    return entry["context_window"] if entry else None


def provider_model(model: Optional[str], account: Optional[str] = None) -> bool:
    return _provider_entry(model, account) is not None


def _cli_levels(info: dict[str, Any]) -> list[str]:
    return max((_levels(entry) for entry in _entries(info)), key=len, default=[])


def models(info: dict[str, Any], account: Optional[str] = None) -> list[dict]:
    """The CLI's model lineup in the capabilities shape."""
    from services import accounts

    resolved = _target(account)
    listed = _provider_models.get(resolved)
    if listed:
        levels = _cli_levels(info)
        return [
            {**{k: v for k, v in entry.items() if k != "thinking"},
             "effort_levels": levels if entry.get("thinking") else []}
            for entry in listed
        ]
    if accounts.provider_for(resolved):
        return []
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


def known_model(info: dict[str, Any], model: Optional[str]) -> bool:
    """Whether the CLI still lists this model, anything goes while it reports no lineup."""
    entries = _entries(info)
    return not entries or model is None or any(entry["value"] == model for entry in entries)


def effort_for(
    info: dict[str, Any],
    model: Optional[str],
    effort: Optional[str],
    account: Optional[str] = None,
) -> Optional[str]:
    """The `--effort` value to send, or None when this model does not list that level."""
    wanted = "xhigh" if effort == ULTRACODE_EFFORT else effort
    if wanted in (None, "", "default"):
        return None
    if provider_model(model, account):
        listed = next((entry for entry in models(info, account) if entry["id"] == model), None)
        return wanted if listed and wanted in listed["effort_levels"] else None
    for entry in _entries(info):
        if entry["value"] == (model or "default"):
            return wanted if wanted in _levels(entry) else None
    return wanted
