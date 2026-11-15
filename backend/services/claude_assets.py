"""Read-only views over the local Claude Code installation (plugins, skills, hooks, MCP)
plus the user prompt (USER.md) appended after the system context (CCONNECT.md)."""

import json
import os
import re
import zipfile
from dataclasses import dataclass
from pathlib import Path

import yaml

from core import paths
from core.config import DEFAULT_CWD
from core.display import joined
from services import accounts, asset_icons, claude_manage, cli_settings

_CLAUDE_DIR = Path.home() / ".claude"
SKILLS_DIR = _CLAUDE_DIR / "skills"
_PLUGINS_DIR = _CLAUDE_DIR / "plugins"
KNOWN_MARKETPLACES = _PLUGINS_DIR / "known_marketplaces.json"
_PLUGIN_META_DIR = Path(".claude-plugin")
_CATALOG_FILE = _PLUGIN_META_DIR / "marketplace.json"
_FILE_MARKETPLACE = "file"
_LOCAL_MARKETPLACES = (_FILE_MARKETPLACE, "directory")
_MARKETPLACE_ROOT = "."
_RELATIVE_SOURCE = "./"
LOCAL_MARKETPLACE = "skills-dir"
_CHAT_MODS_DIR = _CLAUDE_DIR / "dev-mods"
_MANIFEST = _PLUGIN_META_DIR / "plugin.json"
_HOOKS_FILE = "hooks/hooks.json"
_PROJECT_KEY_RE = re.compile(r"^[A-Za-z0-9-]+$")
_CLAUDE_JSON = Path.home() / ".claude.json"
_SETTINGS_FILE = _CLAUDE_DIR / "settings.json"
_SETTINGS_LOCAL_FILE = "settings.local.json"
_INSTALLED_PLUGINS = _PLUGINS_DIR / "installed_plugins.json"
_ENGINE = "claude-code"
_MCP_USER_SOURCE = "user"
_MCP_OAUTH_TYPES = ("http", "sse")
_MCP_FILE = ".mcp.json"
_BUNDLES_DIR = _PLUGINS_DIR / "mcpb"
_BUNDLE_SUFFIXES = (".mcpb", ".dxt")
_BUNDLE_URL = "https://"
_BUNDLE_MANIFEST = "manifest.json"
_BUNDLE_RECORDS = "*.metadata.json"
_MCP_AUTH_CACHE = _CLAUDE_DIR / "mcp-needs-auth-cache.json"
_MCP_TOOL_CHARS = re.compile(r"[^A-Za-z0-9_-]")
_CLAUDEAI_CONNECTED = "claudeAiMcpEverConnected"
_CLAUDEAI_PREFIX = "claude.ai "

_tool_labels: tuple[tuple[float, ...], dict[str, str]] = ((), {})

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)
_HEADER_KEYS = ("name", "description")
_YAML_LOADER = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


def get_user_prompt() -> str:
    try:
        return paths.USER_PROMPT_FILE.read_text(encoding="utf-8")
    except OSError:
        return ""


def set_user_prompt(text: str) -> None:
    paths.USER_PROMPT_FILE.write_text(text, encoding="utf-8")


def get_commit_prompt() -> str:
    try:
        return paths.COMMIT_PROMPT_FILE.read_text(encoding="utf-8")
    except OSError:
        return ""


def commit_instructions() -> str:
    """What the commit writer is told: the user's own file, or the one shipped with the app."""
    for source in (paths.COMMIT_PROMPT_FILE, paths.PROMPTS_DIR / "COMMIT.md"):
        try:
            text = source.read_text(encoding="utf-8").strip()
        except OSError:
            continue
        if text:
            return text
    return ""


def set_commit_prompt(text: str) -> None:
    paths.COMMIT_PROMPT_FILE.write_text(text, encoding="utf-8")


def get_project_prompt(project_key: str) -> str:
    if not _PROJECT_KEY_RE.match(project_key or ""):
        return ""
    try:
        return (paths.PROJECT_PROMPTS_DIR / f"{project_key}.md").read_text(encoding="utf-8")
    except OSError:
        return ""


def project_prompts() -> dict[str, str]:
    return {
        file.stem: text
        for file in sorted(paths.PROJECT_PROMPTS_DIR.glob("*.md"))
        if _PROJECT_KEY_RE.match(file.stem) and (text := get_project_prompt(file.stem))
    }


def prompts() -> dict:
    return {"user": get_user_prompt(), "commit": get_commit_prompt(), "projects": project_prompts()}


def set_project_prompt(project_key: str, text: str) -> None:
    if not _PROJECT_KEY_RE.match(project_key or ""):
        raise ValueError("invalid project key")
    (paths.PROJECT_PROMPTS_DIR / f"{project_key}.md").write_text(text, encoding="utf-8")


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _enabled_plugins() -> dict:
    data = _read_json(_SETTINGS_FILE).get("enabledPlugins")
    return data if isinstance(data, dict) else {}


def known_marketplaces() -> dict:
    return _read_json(KNOWN_MARKETPLACES)


def _auto_update(info: dict, declared: dict) -> bool:
    for value in (declared.get("autoUpdate"), info.get("autoUpdate")):
        if isinstance(value, bool):
            return value
    return (info.get("source") or {}).get("repo") == claude_manage.OFFICIAL_MARKETPLACE


def list_marketplaces() -> list[dict]:
    declared = cli_settings.declared_marketplaces()
    items = []
    for name, info in known_marketplaces().items():
        if not isinstance(info, dict):
            continue
        source = info.get("source") or {}
        items.append({
            "name": name,
            "repo": source.get("repo") or source.get("url"),
            "last_updated": info.get("lastUpdated"),
            "auto_update": _auto_update(info, declared.get(name, {})),
        })
    items.sort(key=lambda m: m["name"])
    return items


@dataclass(frozen=True)
class _Marketplace:
    root: Path | None
    catalog: dict
    local: bool


def _marketplace(info: object) -> _Marketplace:
    """A known marketplace's root and catalog; one added from a local file reads that file where it is."""
    location = info.get("installLocation") if isinstance(info, dict) else None
    if not location:
        return _Marketplace(None, {}, False)
    source = info.get("source")
    kind = source.get("source") if isinstance(source, dict) else None
    named = source.get("path") if kind == _FILE_MARKETPLACE else None
    catalog = Path(named) if named else Path(location) / _CATALOG_FILE
    return _Marketplace(Path(location), _read_json(catalog), kind in _LOCAL_MARKETPLACES)


def _catalog_plugins(catalog: dict) -> list[dict]:
    plugins = catalog.get("plugins")
    return [entry for entry in plugins if isinstance(entry, dict) and entry.get("name")] if isinstance(plugins, list) else []


def _catalog_entry(market: _Marketplace, name: str) -> dict:
    return next((entry for entry in _catalog_plugins(market.catalog) if entry["name"] == name), {})


def _in_place(market: _Marketplace, entry: dict) -> Path | None:
    """Where the CLI loads a relative-path plugin of a marketplace added from a local path, instead of its cached copy."""
    source = entry.get("source")
    if not market.local or market.root is None or not isinstance(source, str):
        return None
    if source == _MARKETPLACE_ROOT or source.startswith(_RELATIVE_SOURCE):
        return market.root / source
    metadata = market.catalog.get("metadata")
    base = metadata.get("pluginRoot") if isinstance(metadata, dict) else None
    return market.root / base / source if isinstance(base, str) and "/" not in source else None


def _install_root(market: _Marketplace, entry: dict, install: dict) -> Path | None:
    path = install.get("installPath")
    return _in_place(market, entry) or (Path(path) if path else None)


def read_manifest(root: Path) -> dict:
    return _read_json(root / _MANIFEST)


def plugin_id(plugin: dict) -> str:
    return f"{plugin['name']}@{plugin['marketplace']}"


def _declared(manifest: dict, key: str, default: str) -> list:
    """The plugin's default file for a component, then each shape its manifest declares, in the CLI's load order."""
    declared = manifest.get(key)
    return [default, *(declared if isinstance(declared, list) else [declared])]


def _engine_range(manifest: dict) -> str | None:
    engines = manifest.get("engines")
    wanted = engines.get(_ENGINE) if isinstance(engines, dict) else None
    return wanted if isinstance(wanted, str) else None


def _hook_configs(root: Path, manifest: dict) -> list[dict]:
    configs = []
    seen: set[Path] = set()
    for source in _declared(manifest, "hooks", _HOOKS_FILE):
        if isinstance(source, dict):
            configs.append(source)
        elif isinstance(source, str) and (path := (root / source).resolve()) not in seen:
            seen.add(path)
            configs.append(_read_json(path))
    return configs


def _is_mod(root: Path, manifest: dict) -> bool:
    return any(config.get("modules") for config in _hook_configs(root, manifest))


def _plugin_item(name: str, marketplace: str, root: Path | None, manifest: dict | None = None, **fields) -> dict:
    if manifest is None:
        manifest = read_manifest(root) if root else {}
    icon = asset_icons.file_of(root, manifest) if root else None
    return {
        "name": name,
        "marketplace": marketplace,
        **fields,
        "install_path": str(root) if root else None,
        "mod": root is not None and _is_mod(root, manifest),
        "options": bool(manifest.get("userConfig")),
        "engine": _engine_range(manifest),
        "local": marketplace == LOCAL_MARKETPLACE,
        "icon": asset_icons.file_version(icon) if icon else None,
    }


def _local_plugins(taken: set[str], enabled: dict) -> list[dict]:
    items = []
    for manifest_file in sorted(SKILLS_DIR.glob(f"*/{_MANIFEST.as_posix()}")):
        root = manifest_file.parent.parent
        manifest = _read_json(manifest_file)
        name = manifest.get("name") or root.name
        if name in taken:
            continue
        items.append(_plugin_item(
            name, LOCAL_MARKETPLACE, root, manifest,
            version=manifest.get("version"),
            scope="user",
            enabled=bool(enabled.get(f"{name}@{LOCAL_MARKETPLACE}", True)),
            description=manifest.get("description"),
        ))
    return items


def list_plugins() -> list[dict]:
    installed = _read_json(_INSTALLED_PLUGINS).get("plugins", {})
    enabled = _enabled_plugins()
    known = known_marketplaces()
    markets: dict[str, _Marketplace] = {}
    items = []
    for key, installs in installed.items():
        if not isinstance(installs, list) or not installs:
            continue
        name, _, marketplace = key.partition("@")
        info = installs[0]
        if marketplace not in markets:
            markets[marketplace] = _marketplace(known.get(marketplace))
        entry = _catalog_entry(markets[marketplace], name)
        items.append(_plugin_item(
            name, marketplace, _install_root(markets[marketplace], entry, info),
            version=(info.get("version") or "").replace("unknown", "") or None,
            scope=info.get("scope"),
            enabled=bool(enabled.get(key, True)),
            description=entry.get("description"),
        ))
    items += _local_plugins({item["name"] for item in items}, enabled)
    items.sort(key=lambda p: (not p["enabled"], p["name"]))
    return items


def listed_plugins() -> list[dict]:
    """The plugins, each with the Claude Code version range the CLI refuses to load it for, if it does."""
    plugins = list_plugins()
    refused = claude_manage.version_refused() if any(plugin["engine"] for plugin in plugins) else set()
    return [{**plugin, "needs_cli": plugin["engine"] if plugin_id(plugin) in refused else None} for plugin in plugins]


def plugin_root(plugin: str) -> Path | None:
    name, _, marketplace = plugin.partition("@")
    if marketplace == LOCAL_MARKETPLACE:
        return next((Path(item["install_path"]) for item in _local_plugins(set(), {}) if item["name"] == name), None)
    installs = _read_json(_INSTALLED_PLUGINS).get("plugins", {}).get(plugin)
    if not isinstance(installs, list) or not installs:
        return None
    market = _marketplace(known_marketplaces().get(marketplace))
    return _install_root(market, _catalog_entry(market, name), installs[0])


def _plugin_icon(root: Path | None) -> Path | None:
    return asset_icons.file_of(root, read_manifest(root)) if root else None


def plugin_icon(plugin: str) -> Path | None:
    return _plugin_icon(plugin_root(plugin))


def list_chat_mods(installed: set[str]) -> list[dict]:
    items = []
    for manifest_file in _CHAT_MODS_DIR.glob(f"*/*/{_MANIFEST.as_posix()}"):
        root = manifest_file.parent.parent
        manifest = _read_json(manifest_file)
        name = manifest.get("name") or root.name
        items.append({
            "name": name,
            "description": manifest.get("description"),
            "version": manifest.get("version"),
            "path": str(root),
            "session_id": root.parent.name,
            "installed": name in installed,
            "modified": int(manifest_file.stat().st_mtime * 1000),
        })
    items.sort(key=lambda m: m["modified"], reverse=True)
    return items


def _skill_meta(skill_file: Path) -> dict | None:
    try:
        text = skill_file.read_text(encoding="utf-8")
    except OSError:
        return None
    match = _FRONTMATTER_RE.match(text)
    return (_header_fields(match.group(1)) if match else {}) or None


def _header_fields(header: str) -> dict:
    """The name and description of a frontmatter, read as YAML like Claude Code reads it, line by line when it is not valid YAML."""
    try:
        parsed = yaml.load(header, Loader=_YAML_LOADER)
    except yaml.YAMLError:
        parsed = None
    if isinstance(parsed, dict):
        return {key: str(parsed[key]).strip() for key in _HEADER_KEYS if parsed.get(key) is not None}
    fields = {}
    for line in header.splitlines():
        key, _, value = line.partition(":")
        if key.strip() in _HEADER_KEYS:
            fields[key.strip()] = value.strip().strip("\"'")
    return fields


def list_skills() -> list[dict]:
    items = []
    seen: set[tuple[str, str]] = set()
    for plugin in list_plugins():
        install = plugin.get("install_path")
        if not install:
            continue
        skills_dir = Path(install) / "skills"
        if not skills_dir.is_dir():
            continue
        for skill_file in sorted(skills_dir.glob("*/SKILL.md")):
            meta = _skill_meta(skill_file) or {}
            name = meta.get("name") or skill_file.parent.name
            key = (plugin["name"], name)
            if key in seen:
                continue
            seen.add(key)
            items.append({
                "name": name,
                "id": skill_file.parent.name,
                "description": meta.get("description"),
                "plugin": plugin_id(plugin),
                "plugin_name": plugin["name"],
                "enabled": plugin["enabled"],
            })
    if SKILLS_DIR.is_dir():
        for skill_file in sorted(SKILLS_DIR.glob("*/SKILL.md")):
            meta = _skill_meta(skill_file) or {}
            items.append({
                "name": meta.get("name") or skill_file.parent.name,
                "id": skill_file.parent.name,
                "description": meta.get("description"),
                "plugin": None,
                "plugin_name": None,
                "enabled": True,
            })
    items.sort(key=lambda s: (not s["enabled"], s["name"]))
    return items


def _hook_entries(config: dict, source: str, plugin: dict | None = None) -> list[dict]:
    events = config.get("hooks")
    items = []
    for event, groups in events.items() if isinstance(events, dict) else ():
        for group in groups if isinstance(groups, list) else ():
            handlers = group.get("hooks") if isinstance(group, dict) else None
            for hook in handlers if isinstance(handlers, list) else ():
                if not isinstance(hook, dict):
                    continue
                items.append({
                    "event": event,
                    "matcher": group.get("matcher") or None,
                    "if": hook.get("if"),
                    "type": hook.get("type"),
                    "command": hook.get("command"),
                    "prompt": hook.get("prompt"),
                    "url": hook.get("url"),
                    "timeout": hook.get("timeout"),
                    "source": source,
                    "plugin": plugin_id(plugin) if plugin else None,
                    "plugin_name": plugin["name"] if plugin else None,
                })
    return items


def list_hooks(cwd: str | None = None) -> list[dict]:
    project = Path(_mcp_folder(cwd)) / _CLAUDE_DIR.name
    items = []
    seen: set[Path] = set()
    for source, path in (
        (_MCP_USER_SOURCE, _SETTINGS_FILE),
        ("project", project / _SETTINGS_FILE.name),
        ("local", project / _SETTINGS_LOCAL_FILE),
    ):
        if path.resolve() not in seen:
            seen.add(path.resolve())
            items += _hook_entries(_read_json(path), source)
    for plugin in list_plugins():
        if plugin["enabled"] and plugin["install_path"]:
            root = Path(plugin["install_path"])
            for config in _hook_configs(root, read_manifest(root)):
                items += _hook_entries(config, "plugin", plugin)
    return items


_SKILL_ID_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _skill_dir(plugin: str | None, skill_id: str) -> Path:
    if not _SKILL_ID_RE.match(skill_id or ""):
        raise ValueError("invalid skill id")
    if not plugin:
        return SKILLS_DIR / skill_id
    root = plugin_root(plugin)
    if root is None:
        raise ValueError("unknown plugin")
    return root / "skills" / skill_id


def list_skill_files(plugin: str | None, skill_id: str) -> list[str]:
    skill_dir = _skill_dir(plugin, skill_id)
    if not skill_dir.is_dir():
        return []
    files = []
    if (skill_dir / "SKILL.md").is_file():
        files.append("SKILL.md")
    for md in sorted(skill_dir.glob("**/*.md")):
        rel = md.relative_to(skill_dir).as_posix()
        if rel != "SKILL.md":
            files.append(rel)
    return files


def read_skill(plugin: str | None, skill_id: str, file: str = "SKILL.md") -> str | None:
    skill_dir = _skill_dir(plugin, skill_id)
    if not file or ".." in file or file.startswith("/") or not file.endswith(".md"):
        raise ValueError("invalid file")
    path = skill_dir / file
    try:
        path.resolve().relative_to(skill_dir.resolve())
    except ValueError:
        raise ValueError("invalid file")
    return path.read_text(encoding="utf-8") if path.is_file() else None


def marketplace_catalog(name: str) -> list[dict]:
    info = known_marketplaces().get(name)
    if not isinstance(info, dict):
        raise ValueError("unknown marketplace")
    installed = {(p["name"], p["marketplace"]) for p in list_plugins()}
    items = []
    for plugin in _catalog_plugins(_marketplace(info).catalog):
        items.append({
            "name": plugin["name"],
            "description": plugin.get("description"),
            "version": plugin.get("version"),
            "installed": (plugin["name"], name) in installed,
        })
    items.sort(key=lambda p: (not p["installed"], p["name"]))
    return items


def _project_path(project_key: str) -> Path | None:
    from services.chat_list import hub
    for project in hub.projects():
        if project.get("project_key") == project_key and project.get("path"):
            return Path(project["path"])
    return None


_MEMORY_NAME_RE = re.compile(r"^[\w.\- ]+\.md$")

_REPO_MEMORIES = ("CLAUDE.md", "AGENTS.md")


def _memory_file(scope: str, project_key: str, name: str) -> Path:
    if scope == "global":
        return _CLAUDE_DIR / "CLAUDE.md"
    if scope == "repo":
        root = _project_path(project_key)
        if root is None:
            raise ValueError("unknown project")
        if name not in _REPO_MEMORIES:
            raise ValueError("invalid memory name")
        return root / name
    if scope == "memory":
        if not re.match(r"^[A-Za-z0-9._-]+$", project_key or "") or set(project_key) == {"."}:
            raise ValueError("invalid project key")
        if not _MEMORY_NAME_RE.match(name or ""):
            raise ValueError("invalid memory name")
        return _CLAUDE_DIR / "projects" / project_key / "memory" / name
    raise ValueError("invalid scope")


def list_memories(project_key: str | None) -> dict:
    out: dict = {"global": [], "project": []}
    if (_CLAUDE_DIR / "CLAUDE.md").is_file():
        out["global"].append({"scope": "global", "name": "CLAUDE.md", "description": None})
    if project_key:
        root = _project_path(project_key)
        for name in _REPO_MEMORIES if root is not None else ():
            file = root / name
            if file.is_file():
                out["project"].append({"scope": "repo", "name": name, "description": str(file)})
        memory_dir = _CLAUDE_DIR / "projects" / project_key / "memory"
        if memory_dir.is_dir():
            for file in sorted(memory_dir.glob("*.md")):
                meta = _skill_meta(file)
                out["project"].append({
                    "scope": "memory",
                    "name": file.name,
                    "description": meta.get("description") if meta else None,
                })
    return out


def read_memory(scope: str, project_key: str, name: str) -> str | None:
    path = _memory_file(scope, project_key, name)
    return path.read_text(encoding="utf-8") if path.is_file() else None


def delete_memory(scope: str, project_key: str, name: str) -> bool:
    path = _memory_file(scope, project_key, name)
    if not path.is_file():
        return False
    path.unlink()
    if scope == "memory" and path.name != "MEMORY.md":
        index = path.parent / "MEMORY.md"
        if index.is_file():
            lines = index.read_text(encoding="utf-8").splitlines()
            kept = [line for line in lines if f"({path.name})" not in line]
            if len(kept) != len(lines):
                index.write_text("\n".join(kept) + "\n", encoding="utf-8")
    return True


@dataclass(frozen=True)
class _McpLogins:
    needs_auth: set[str]
    tokens: dict[str, dict[str, str]]


def _mcp_entry(
    name: str, label: str, cfg: dict, enabled: bool, source: str, logins: _McpLogins, icon: Path | str | None
) -> dict:
    kind = cfg.get("type") or ("http" if cfg.get("url") else "stdio")
    detail = cfg.get("url") or " ".join([cfg.get("command", ""), *cfg.get("args", [])]).strip()
    return {
        "name": name,
        "label": label,
        "type": kind,
        "detail": detail or None,
        "enabled": enabled,
        "source": source,
        "oauth": kind in _MCP_OAUTH_TYPES and (
            bool(cfg.get("oauth")) or name in logins.needs_auth or any(name in tokens for tokens in logins.tokens.values())
        ),
        "signed_in": sorted(account for account, tokens in logins.tokens.items() if tokens.get(name)),
        "icon": _icon_version(icon),
    }


def _icon_version(icon: Path | str | None) -> str | None:
    if icon is None:
        return None
    return asset_icons.file_version(icon) if isinstance(icon, Path) else asset_icons.uri_version(icon)


def _mcp_icon(name: str, plugin: dict | None, uris: dict[str, str]) -> Path | str | None:
    if name in uris:
        return uris[name]
    root = plugin.get("install_path") if plugin else None
    return _plugin_icon(Path(root)) if root else None


def _mcp_map(servers: object) -> dict:
    return {name: cfg for name, cfg in servers.items() if isinstance(cfg, dict)} if isinstance(servers, dict) else {}


def _bundle_manifest(root: Path, source: str) -> dict:
    """A bundle's manifest, from the archive the plugin ships or from the copy the CLI extracted from a URL."""
    if source.startswith(_BUNDLE_URL):
        records = (_read_json(path) for path in _BUNDLES_DIR.glob(_BUNDLE_RECORDS))
        extracted = next((record.get("extractedPath") for record in records if record.get("source") == source), None)
        return _read_json(Path(extracted) / _BUNDLE_MANIFEST) if extracted else {}
    try:
        with zipfile.ZipFile(root / source) as archive:
            manifest = json.loads(archive.read(_BUNDLE_MANIFEST))
    except (OSError, KeyError, ValueError, zipfile.BadZipFile):
        return {}
    return manifest if isinstance(manifest, dict) else {}


def _bundle_mcp(root: Path, source: str) -> dict:
    manifest = _bundle_manifest(root, source)
    server = manifest.get("server")
    config = server.get("mcp_config") if isinstance(server, dict) else None
    name = manifest.get("name")
    return {name: config} if isinstance(name, str) and isinstance(config, dict) else {}


def _mcp_source(root: Path, source: object) -> dict:
    if isinstance(source, dict):
        return _mcp_map(source)
    if not isinstance(source, str):
        return {}
    if source.lower().endswith(_BUNDLE_SUFFIXES):
        return _bundle_mcp(root, source)
    data = _read_json(root / source)
    return _mcp_map(data.get("mcpServers", data))


def _plugin_mcp(root: Path) -> dict:
    servers: dict = {}
    for source in _declared(read_manifest(root), "mcpServers", _MCP_FILE):
        servers.update(_mcp_source(root, source))
    return servers


def _same_folder(first: str, second: str) -> bool:
    return os.path.normcase(os.path.normpath(first)) == os.path.normcase(os.path.normpath(second))


@dataclass(frozen=True)
class DeclaredMcp:
    name: str
    label: str
    config: dict
    enabled: bool
    source: str
    muted: bool = False
    plugin: dict | None = None


def _declared_mcp(folder: str) -> list[DeclaredMcp]:
    config = _read_json(_CLAUDE_JSON)
    projects = config.get("projects")
    local = next(
        (entry for key, entry in projects.items() if isinstance(entry, dict) and _same_folder(key, folder)),
        {},
    ) if isinstance(projects, dict) else {}
    skipped = local.get("disabledMcpjsonServers") or []
    muted = local.get("disabledMcpServers") or []
    return [
        *(
            DeclaredMcp(name, name, cfg, True, _MCP_USER_SOURCE, name in muted)
            for name, cfg in _mcp_map(config.get("mcpServers")).items()
        ),
        *(DeclaredMcp(name, name, cfg, True, "local", name in muted) for name, cfg in _mcp_map(local.get("mcpServers")).items()),
        *(
            DeclaredMcp(name, name, cfg, name not in skipped, "project", name in muted)
            for name, cfg in _mcp_map(_read_json(Path(folder) / _MCP_FILE).get("mcpServers")).items()
        ),
        *(
            DeclaredMcp(
                f"plugin:{plugin['name']}:{name}",
                name if name == plugin["name"] else joined(plugin["name"], name),
                cfg,
                True,
                "plugin",
                f"plugin:{plugin['name']}:{name}" in muted,
                plugin,
            )
            for plugin in list_plugins()
            if plugin["enabled"] and plugin["install_path"]
            for name, cfg in _plugin_mcp(Path(plugin["install_path"])).items()
        ),
    ]


def _mcp_folder(cwd: str | None) -> str:
    return cwd if cwd and Path(cwd).is_dir() else DEFAULT_CWD


def mcp_config(name: str, cwd: str | None = None) -> dict | None:
    return next((declared.config for declared in _declared_mcp(_mcp_folder(cwd)) if declared.name == name), None)


def declared_mcp(cwd: str | None) -> list[DeclaredMcp]:
    return _declared_mcp(_mcp_folder(cwd))


def list_mcp_servers(cwd: str | None = None) -> list[dict]:
    folder = _mcp_folder(cwd)
    logins = _McpLogins(
        needs_auth=set(_read_json(_MCP_AUTH_CACHE)),
        tokens={account: accounts.mcp_tokens(account) for account in accounts.known_ids()},
    )
    declared = _declared_mcp(folder)
    disabled = {name: cfg for name, cfg in claude_manage.disabled_mcp_servers().items() if isinstance(cfg, dict)}
    uris = asset_icons.declared_uris([server.name for server in declared] + list(disabled))
    items = [
        _mcp_entry(
            server.name, server.label, server.config, server.enabled, server.source, logins,
            _mcp_icon(server.name, server.plugin, uris),
        )
        for server in declared
    ]
    for name, cfg in disabled.items():
        if not any(i["name"] == name for i in items):
            items.append(_mcp_entry(name, name, cfg, False, _MCP_USER_SOURCE, logins, _mcp_icon(name, None, uris)))
    items.sort(key=lambda s: (not s["enabled"], s["name"]))
    return items


def mcp_icon(name: str, cwd: str | None = None) -> Path | str | None:
    server = next((declared for declared in _declared_mcp(_mcp_folder(cwd)) if declared.name == name), None)
    return _mcp_icon(name, server.plugin if server else None, asset_icons.declared_uris([name]))


def _modified(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


def mcp_tool_labels() -> dict[str, str]:
    global _tool_labels
    version = tuple(_modified(path) for path in (_CLAUDE_JSON, _INSTALLED_PLUGINS, _SETTINGS_FILE))
    if _tool_labels[0] != version:
        connectors = _read_json(_CLAUDE_JSON).get(_CLAUDEAI_CONNECTED)
        labels = {_MCP_TOOL_CHARS.sub("_", server.name): server.label for server in _declared_mcp(DEFAULT_CWD)}
        for name in connectors if isinstance(connectors, list) else []:
            if isinstance(name, str):
                labels[_MCP_TOOL_CHARS.sub("_", name)] = name.removeprefix(_CLAUDEAI_PREFIX)
        _tool_labels = (version, labels)
    return _tool_labels[1]
