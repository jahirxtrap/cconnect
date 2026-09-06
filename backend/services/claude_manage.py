"""Mutating operations on the local Claude Code installation, driven through its CLI."""

import json
import subprocess
from pathlib import Path

from core import cli_manager
from services import accounts

_PLUGIN_ACTIONS = frozenset({"install", "uninstall", "enable", "disable", "update"})
_MARKETPLACE_ACTIONS = frozenset({"add", "remove", "update"})


def _shared(result: dict) -> dict:
    """Push a successful change out to the secondary accounts."""
    if result.get("ok"):
        accounts.sync_all_shared_config()
    return result


def _cli() -> str | None:
    return cli_manager.resolve_cli_path() or cli_manager.system_cli()


def _run(args: list[str], timeout: int = 300, cwd: str | None = None) -> dict:
    cli = _cli()
    if not cli:
        return {"ok": False, "message": "No CLI available"}
    try:
        result = subprocess.run(
            [cli, *args],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=timeout, cwd=cwd,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return {"ok": False, "message": str(exc)}
    output = (result.stdout + result.stderr).strip()
    return {"ok": result.returncode == 0, "message": output}


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


def plugin_action(action: str, plugin: str) -> dict:
    if action not in _PLUGIN_ACTIONS:
        return {"ok": False, "message": f"invalid action: {action}"}
    args = ["plugin", action, plugin]
    cwd = None
    if action != "install":
        scope, project_path = _plugin_install_info(plugin)
        if scope:
            args += ["-s", scope]
        if project_path and Path(project_path).is_dir():
            cwd = project_path
    return _shared(_run(args, cwd=cwd))


def marketplace_action(action: str, target: str) -> dict:
    if action not in _MARKETPLACE_ACTIONS:
        return {"ok": False, "message": f"invalid action: {action}"}
    return _shared(_run(["plugin", "marketplace", action, target]))


def mcp_add(name: str, target: str, transport: str = "stdio") -> dict:
    if not name or not target:
        return {"ok": False, "message": "name and command/url are required"}
    if transport in ("http", "sse"):
        return _shared(_run(["mcp", "add", "-s", "user", "--transport", transport, name, target]))
    return _shared(_run(["mcp", "add", "-s", "user", name, "--", *target.split()]))


def mcp_remove(name: str) -> dict:
    if not name:
        return {"ok": False, "message": "name is required"}
    store = _disabled_store()
    if name in store:
        store.pop(name)
        _MCP_DISABLED.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return {"ok": True, "message": ""}
    return _shared(_run(["mcp", "remove", name]))


_MCP_DISABLED = Path(__file__).resolve().parent.parent / "mcp_disabled.json"


def _disabled_store() -> dict:
    try:
        return json.loads(_MCP_DISABLED.read_text(encoding="utf-8"))
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
            _MCP_DISABLED.write_text(json.dumps(store, indent=2), encoding="utf-8")
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
        _MCP_DISABLED.write_text(json.dumps(store, indent=2), encoding="utf-8")
    return _shared(result)
