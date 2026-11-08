"""Mutating operations on the local Claude Code installation, driven through its CLI."""

import asyncio
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from core import cli_manager, paths
from core.db import Session
from core.models import DisabledMcpServer
from services import accounts, claude_assets, cli_settings, files, git

_PLUGIN_ACTIONS = frozenset({"install", "uninstall", "enable", "disable", "update"})
_PLUGIN_REMOVALS = frozenset({"uninstall", "disable"})
_MARKETPLACE_ACTIONS = frozenset({"add", "remove", "update"})
_MCP_REMOTE = ("http", "sse")

OFFICIAL_MARKETPLACE = "anthropics/claude-plugins-official"

_ENV_ENTRY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
_FOLDER_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_GITHUB_REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
_NOTE = re.compile(r"^\S+ (hooks|calls): (.+)$")
_NOTE_ITEMS = re.compile(r",\s*(?![^{]*\})")
_VIA = re.compile(r"\s*\(via [^)]*\)$")
_COMMAND_HOOK = re.compile(r"^command\.run\{command=([^}]+)\}$")
_COPY_SKIPS = (".git", "node_modules")
_SECURE_GIT = "https://"
_SKILL_FILE = "SKILL.md"
_CLONE_TIMEOUT = 120


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


async def reload_plugins(force: bool, command: str = "reload-plugins") -> dict:
    from services.live_sessions import registry

    reports = await asyncio.gather(*(live.reload(command, hold=not force) for live in registry.residents()))
    return {"held": sum(1 for report in reports if report and report.get("held"))}


async def reload_after(result: dict, command: str = "reload-plugins") -> dict:
    return {**result, **await reload_plugins(False, command)} if result.get("ok") else result


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
        return _remove_local(plugin)
    if action == "install":
        return _run(["plugin", action, plugin])
    flags, cwd = _plugin_place(plugin)
    return _run(["plugin", action, plugin, *flags], cwd=cwd)


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
    return _run(["plugin", "configure", "--values-stdin", plugin], cwd=cwd, stdin=json.dumps(values))


def add_local_plugin(source: str) -> dict:
    folder = Path(source).expanduser()
    name = claude_assets.read_manifest(folder).get("name")
    if not isinstance(name, str) or not _FOLDER_NAME.match(name):
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
    return {"ok": True, "message": ""}


def _clone_url(source: str) -> str | None:
    if _GITHUB_REPO.match(source):
        return f"https://github.com/{source}.git"
    return source if source.startswith(_SECURE_GIT) else None


def _skill_skips(directory: str, names: list[str]) -> list[str]:
    return [name for name in names if name in _COPY_SKIPS or paths.is_link(Path(directory) / name)]


def _fetch_skill(url: str, path: str, ref: str, scratch: Path) -> Path | str:
    checkout = scratch / "checkout"
    branch = ["--branch", ref] if ref else []
    steps = [
        (scratch, ["clone", "--depth", "1", "--filter=blob:none", "--sparse", *branch, "--", url, str(checkout)]),
        (checkout, ["sparse-checkout", "set", path] if path else ["sparse-checkout", "disable"]),
    ]
    for root, args in steps:
        try:
            done = git.run(root, *args, timeout=_CLONE_TIMEOUT, writes=True)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return str(exc)
        if done.returncode != 0:
            return (done.stderr.strip().splitlines() or [f"git {args[0]} failed"])[-1]
    folder = (checkout / path).resolve()
    if not folder.is_relative_to(checkout.resolve()) or not (folder / _SKILL_FILE).is_file():
        return f"no {_SKILL_FILE} in {path or 'the root of the repository'}"
    return folder


def install_skill(source: str, path: str, ref: str) -> dict:
    url = _clone_url(source.strip())
    if url is None:
        return {"ok": False, "message": "the source must be owner/repo on GitHub or an https git URL"}
    path = path.strip().strip("/")
    name = (path or url.removesuffix(".git")).rstrip("/").rpartition("/")[2]
    if not _FOLDER_NAME.match(name):
        return {"ok": False, "message": f"{name} is not a valid skill name"}
    target = claude_assets.SKILLS_DIR / name
    if claude_assets.read_manifest(target):
        return {"ok": False, "message": f"the local plugin {name} already uses that name"}
    scratch = Path(tempfile.mkdtemp(prefix="cconnect-skill-"))
    try:
        folder = _fetch_skill(url, path, ref.strip(), scratch)
        if isinstance(folder, str):
            return {"ok": False, "message": folder}
        if paths.is_link(target):
            paths.unlink_dir(target)
        elif target.exists() and not paths.remove_tree(target):
            return {"ok": False, "message": f"{target} could not be replaced"}
        shutil.copytree(folder, target, ignore=_skill_skips)
    except OSError as exc:
        paths.remove_tree(target)
        return {"ok": False, "message": str(exc)}
    finally:
        paths.remove_tree(scratch)
    return {"ok": True, "message": ""}


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
    return _run(["plugin", "marketplace", action, target])


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
    return {"ok": True, "message": ""}


async def ensure_official_marketplace() -> None:
    if claude_assets.list_marketplaces():
        return
    await asyncio.to_thread(marketplace_action, "add", OFFICIAL_MARKETPLACE)


def _mcp_add(name: str, transport: str, target: str, args: list[str], env: list[str], headers: dict[str, str]) -> dict:
    if not name or not target:
        return {"ok": False, "message": "name and command/url are required"}
    if transport in _MCP_REMOTE:
        flags = [arg for key, value in headers.items() for arg in ("--header", f"{key}: {value}")]
        return _run(["mcp", "add", "-s", "user", "--transport", transport, name, target, *flags])
    if not all(_ENV_ENTRY.match(entry) for entry in env):
        return {"ok": False, "message": "environment variables go one per line as KEY=value"}
    flags = [arg for entry in env for arg in ("-e", entry)]
    return _run(["mcp", "add", "-s", "user", name, *flags, "--", target, *args])


def mcp_add(
    name: str, target: str, transport: str = "stdio", auth: dict | None = None, env: list[str] | None = None
) -> dict:
    if transport in _MCP_REMOTE:
        return _mcp_add(name, transport, target, [], [], accounts.auth_headers(auth or {}))
    command, *args = target.split() or [""]
    entries = [entry.strip() for entry in env or () if entry.strip()]
    return _mcp_add(name, transport, command, args, entries, {})


def mcp_add_config(name: str, config: dict) -> dict:
    if config.get("url"):
        transport = config.get("type") if config.get("type") in _MCP_REMOTE else _MCP_REMOTE[0]
        return _mcp_add(name, transport, config["url"], [], [], config.get("headers") or {})
    env = [f"{key}={value}" for key, value in (config.get("env") or {}).items()]
    return _mcp_add(name, "stdio", config.get("command") or "", config.get("args") or [], env, {})


def mcp_remove(name: str) -> dict:
    if not name:
        return {"ok": False, "message": "name is required"}
    if _enable(name):
        return {"ok": True, "message": ""}
    return _run(["mcp", "remove", name])


def disabled_mcp_servers() -> dict:
    with Session() as session:
        return {row.name: row.config for row in session.query(DisabledMcpServer).order_by(DisabledMcpServer.name)}


def _enable(name: str) -> bool:
    with Session() as session:
        removed = session.query(DisabledMcpServer).filter(DisabledMcpServer.name == name).delete()
        session.commit()
    return removed > 0


def _disable(name: str, config: dict) -> None:
    with Session() as session:
        session.merge(DisabledMcpServer(name=name, config=config))
        session.commit()


def mcp_set_enabled(name: str, enabled: bool) -> dict:
    if not name:
        return {"ok": False, "message": "name is required"}
    if enabled:
        cfg = disabled_mcp_servers().get(name)
        if cfg is None:
            return {"ok": False, "message": "server is not disabled"}
        result = _run(["mcp", "add-json", "-s", "user", name, json.dumps(cfg)])
        if result["ok"]:
            _enable(name)
        return result
    try:
        servers = json.loads((Path.home() / ".claude.json").read_text(encoding="utf-8")).get("mcpServers", {})
    except (OSError, json.JSONDecodeError):
        servers = {}
    cfg = servers.get(name)
    if not isinstance(cfg, dict):
        return {"ok": False, "message": "server not found"}
    result = _run(["mcp", "remove", name])
    if result["ok"]:
        _disable(name, cfg)
    return result
