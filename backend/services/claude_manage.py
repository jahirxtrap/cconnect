"""Mutating operations on the local Claude Code installation, driven through its CLI."""

import asyncio
import json
import re
import shutil
import subprocess
from pathlib import Path

from core import cli_manager, paths
from services import accounts, claude_assets, cli_settings, files

_PLUGIN_ACTIONS = frozenset({"install", "uninstall", "enable", "disable", "update"})
_PLUGIN_REMOVALS = frozenset({"uninstall", "disable"})
_MARKETPLACE_ACTIONS = frozenset({"add", "remove", "update"})

OFFICIAL_MARKETPLACE = "anthropics/claude-plugins-official"

_ENV_ENTRY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
_PLUGIN_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_NOTE = re.compile(r"^\S+ (hooks|calls): (.+)$")
_NOTE_ITEMS = re.compile(r",\s*(?![^{]*\})")
_VIA = re.compile(r"\s*\(via [^)]*\)$")
_COMMAND_HOOK = re.compile(r"^command\.run\{command=([^}]+)\}$")
_COPY_SKIPS = (".git", "node_modules")


def _shared(result: dict) -> dict:
    """Push a successful change out to the secondary accounts."""
    if result.get("ok"):
        accounts.sync_all_shared_config()
    return result


def _cli() -> str | None:
    return cli_manager.resolve_cli_path() or cli_manager.system_cli()


def _exec(args: list[str], timeout: int, cwd: str | None, stdin: str | None) -> subprocess.CompletedProcess:
    cli = _cli()
    if not cli:
        raise OSError("No CLI available")
    return subprocess.run(
        [cli, *args],
        input=stdin, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout, cwd=cwd,
    )


def _run(args: list[str], timeout: int = 300, cwd: str | None = None, stdin: str | None = None) -> dict:
    try:
        result = _exec(args, timeout, cwd, stdin)
    except (OSError, subprocess.SubprocessError) as exc:
        return {"ok": False, "message": str(exc)}
    output = (result.stdout + result.stderr).strip()
    return {"ok": result.returncode == 0, "message": output}


def _report(args: list[str], cwd: str | None = None) -> dict | None:
    """The CLI's JSON report, read whatever its exit code says."""
    try:
        data = json.loads(_exec([*args, "--json"], 60, cwd, None).stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _plugin_install_info(plugin: str) -> tuple[str | None, str | None]:
    path = Path.home() / ".claude" / "plugins" / "installed_plugins.json"
    try:
        installs = json.loads(path.read_text(encoding="utf-8")).get("plugins", {}).get(plugin)
    except (OSError, ValueError):
        return None, None
    if not isinstance(installs, list) or not installs:
        return None, None
    info = installs[0]
    return info.get("scope"), info.get("projectPath")


def _plugin_place(plugin: str) -> tuple[list[str], str | None]:
    scope, project_path = _plugin_install_info(plugin)
    return (["-s", scope] if scope else []), (project_path if project_path and Path(project_path).is_dir() else None)


async def reload_plugins(force: bool) -> dict:
    from services.live_sessions import registry

    reports = await asyncio.gather(*(live.reload("reload-plugins", hold=not force) for live in registry.residents()))
    return {"held": sum(1 for report in reports if report and report.get("held"))}


async def reload_after(result: dict) -> dict:
    return {**result, **await reload_plugins(force=False)} if result.get("ok") else result


async def after_plugin_action(action: str, plugin: str, result: dict) -> dict:
    from services.live_sessions import registry

    if result.get("ok") and action in _PLUGIN_REMOVALS:
        name = plugin.partition("@")[0]
        for live in registry.live():
            await live.forget_plugin(name)
    return await reload_after(result)


def plugin_action(action: str, plugin: str) -> dict:
    if action not in _PLUGIN_ACTIONS:
        return {"ok": False, "message": f"invalid action: {action}"}
    if action == "uninstall" and plugin.partition("@")[2] == claude_assets.LOCAL_MARKETPLACE:
        return _shared(_remove_local(plugin))
    if action == "install":
        return _shared(_run(["plugin", action, plugin]))
    flags, cwd = _plugin_place(plugin)
    return _shared(_run(["plugin", action, plugin, *flags], cwd=cwd))


def _review(folder: Path) -> dict | None:
    report = _report(["plugin", "validate", str(folder)])
    if report is None:
        return None
    found: dict[str, dict[str, None]] = {"hooks": {}, "calls": {}}
    errors = []
    for part in [report.get("manifest") or {}, *(report.get("contents") or [])]:
        errors += [item.get("message") if isinstance(item, dict) else str(item) for item in part.get("errors") or []]
        for note in part.get("notes") or []:
            match = _NOTE.match(note) if isinstance(note, str) else None
            if match:
                found[match.group(1)].update(dict.fromkeys(_VIA.sub("", item).strip() for item in _NOTE_ITEMS.split(match.group(2))))
    hooks = [item for item in found["hooks"] if item]
    return {
        "hooks": hooks,
        "calls": [item for item in found["calls"] if item],
        "commands": [match.group(1) for match in map(_COMMAND_HOOK.match, hooks) if match],
        "errors": [error for error in errors if error],
    }


def plugin_review(plugin: str) -> dict | None:
    root = claude_assets.plugin_root(plugin)
    return _review(root) if root is not None and root.is_dir() else None


def plugin_options(plugin: str) -> dict | None:
    report = _report(["plugin", "configure", plugin], _plugin_place(plugin)[1])
    schema = (report or {}).get("schema")
    if not isinstance(schema, dict):
        return None
    inputs = report.get("inputs") or {}
    choices = report.get("choices") or {}
    configured = set(report.get("configured") or [])
    return {"fields": [
        {
            "key": key,
            "type": spec.get("type"),
            "title": spec.get("title") or key,
            "description": spec.get("description"),
            "required": bool(spec.get("required")),
            "secret": bool(spec.get("sensitive")),
            "multiple": bool(spec.get("multiple")),
            "min": spec.get("min"),
            "max": spec.get("max"),
            "value": str(inputs.get(key) or ""),
            "default": None if spec.get("default") is None else str(spec["default"]),
            "choices": [str(choice) for choice in choices.get(key) or []],
            "configured": key in configured,
        }
        for key, spec in schema.items()
        if isinstance(spec, dict)
    ]}


def set_plugin_options(plugin: str, values: dict[str, str]) -> dict:
    cwd = _plugin_place(plugin)[1]
    return _shared(_run(["plugin", "configure", "--values-stdin", plugin], cwd=cwd, stdin=json.dumps(values)))


def add_local_plugin(source: str) -> dict:
    folder = Path(source).expanduser()
    name = claude_assets.read_manifest(folder).get("name")
    if not isinstance(name, str) or not _PLUGIN_NAME.match(name):
        return {"ok": False, "message": "the folder holds no plugin manifest with a valid name"}
    target = claude_assets.SKILLS_DIR / name
    if target.exists():
        return {"ok": False, "message": f"{name} is already installed"}
    review = _review(folder)
    if review is None:
        return {"ok": False, "message": "the plugin could not be validated"}
    if review["errors"]:
        return {"ok": False, "message": "\n".join(review["errors"])}
    try:
        shutil.copytree(folder, target, ignore=shutil.ignore_patterns(*_COPY_SKIPS))
    except OSError as exc:
        return {"ok": False, "message": str(exc)}
    return _shared({"ok": True, "message": ""})


def _remove_local(plugin: str) -> dict:
    root = claude_assets.plugin_root(plugin)
    if root is None or root.parent != claude_assets.SKILLS_DIR:
        return {"ok": False, "message": "plugin not found"}
    try:
        if paths.is_link(root):
            paths.unlink_dir(root)
        else:
            shutil.rmtree(root)
    except OSError as exc:
        return {"ok": False, "message": str(exc)}
    if root.exists() or paths.is_link(root):
        return {"ok": False, "message": f"{root} could not be removed"}
    return {"ok": True, "message": ""}


def marketplace_action(action: str, target: str) -> dict:
    if action not in _MARKETPLACE_ACTIONS:
        return {"ok": False, "message": f"invalid action: {action}"}
    return _shared(_run(["plugin", "marketplace", action, target]))


def set_marketplace_auto_update(name: str, enabled: bool) -> dict:
    known = claude_assets.known_marketplaces()
    if not isinstance(known.get(name), dict):
        return {"ok": False, "message": "marketplace not found"}
    known[name] = {**known[name], "autoUpdate": enabled}
    try:
        files.write_json(claude_assets.KNOWN_MARKETPLACES, known)
        cli_settings.declare_auto_update(name, enabled)
    except OSError as exc:
        return {"ok": False, "message": str(exc)}
    return _shared({"ok": True, "message": ""})


async def ensure_official_marketplace() -> None:
    if claude_assets.list_marketplaces():
        return
    await asyncio.to_thread(marketplace_action, "add", OFFICIAL_MARKETPLACE)


def mcp_add(
    name: str, target: str, transport: str = "stdio", auth: dict | None = None, env: list[str] | None = None
) -> dict:
    if not name or not target:
        return {"ok": False, "message": "name and command/url are required"}
    if transport in ("http", "sse"):
        headers = accounts.auth_headers(auth or {})
        flags = [arg for key, value in headers.items() for arg in ("--header", f"{key}: {value}")]
        return _shared(_run(["mcp", "add", "-s", "user", "--transport", transport, name, target, *flags]))
    entries = [entry.strip() for entry in env or () if entry.strip()]
    if not all(_ENV_ENTRY.match(entry) for entry in entries):
        return {"ok": False, "message": "environment variables go one per line as KEY=value"}
    flags = [arg for entry in entries for arg in ("-e", entry)]
    return _shared(_run(["mcp", "add", "-s", "user", name, *flags, "--", *target.split()]))


def mcp_remove(name: str) -> dict:
    if not name:
        return {"ok": False, "message": "name is required"}
    store = _disabled_store()
    if name in store:
        store.pop(name)
        paths.MCP_DISABLED_FILE.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return {"ok": True, "message": ""}
    return _shared(_run(["mcp", "remove", name]))


def _disabled_store() -> dict:
    try:
        return json.loads(paths.MCP_DISABLED_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def disabled_mcp_servers() -> dict:
    return _disabled_store()


def mcp_set_enabled(name: str, enabled: bool) -> dict:
    if not name:
        return {"ok": False, "message": "name is required"}
    store = _disabled_store()
    if enabled:
        cfg = store.get(name)
        if cfg is None:
            return {"ok": False, "message": "server is not disabled"}
        result = _run(["mcp", "add-json", "-s", "user", name, json.dumps(cfg)])
        if result["ok"]:
            store.pop(name, None)
            paths.MCP_DISABLED_FILE.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return _shared(result)
    try:
        servers = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8")).get("mcpServers", {})
    except (OSError, json.JSONDecodeError):
        servers = {}
    cfg = servers.get(name)
    if not isinstance(cfg, dict):
        return {"ok": False, "message": "server not found"}
    result = _run(["mcp", "remove", name])
    if result["ok"]:
        store[name] = cfg
        paths.MCP_DISABLED_FILE.write_text(json.dumps(store, indent=2), encoding="utf-8")
    return _shared(result)
