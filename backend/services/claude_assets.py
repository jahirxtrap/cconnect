"""Read-only views over the local Claude Code installation (plugins, skills, MCP)
plus the user prompt (USER.md) appended after the system context (CCONNECT.md)."""

import json
import os
import re
from pathlib import Path

from core import paths
from core.config import DEFAULT_CWD
from core.display import joined
from services import claude_manage, cli_settings

_CLAUDE_DIR = Path.home() / ".claude"
SKILLS_DIR = _CLAUDE_DIR / "skills"
KNOWN_MARKETPLACES = _CLAUDE_DIR / "plugins" / "known_marketplaces.json"
LOCAL_MARKETPLACE = "skills-dir"
_CHAT_MODS_DIR = _CLAUDE_DIR / "dev-mods"
_MANIFEST = Path(".claude-plugin") / "plugin.json"
_HOOKS_FILE = "hooks/hooks.json"
_PROJECT_KEY_RE = re.compile(r"^[A-Za-z0-9-]+$")
_CLAUDE_JSON = Path.home() / ".claude.json"
_SETTINGS_FILE = _CLAUDE_DIR / "settings.json"
_INSTALLED_PLUGINS = _CLAUDE_DIR / "plugins" / "installed_plugins.json"
_MCP_USER_SOURCE = "user"
_MCP_NEEDS_AUTH = "needs-auth"
_MCP_FILE = ".mcp.json"
_MCP_AUTH_CACHE = _CLAUDE_DIR / "mcp-needs-auth-cache.json"
_MCP_TOOL_CHARS = re.compile(r"[^A-Za-z0-9_-]")
_CLAUDEAI_CONNECTED = "claudeAiMcpEverConnected"
_CLAUDEAI_PREFIX = "claude.ai "

_tool_labels: tuple[tuple[float, ...], dict[str, str]] = ((), {})

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


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


def _catalog_descriptions(marketplace: str) -> dict[str, str]:
    known = known_marketplaces()
    location = (known.get(marketplace) or {}).get("installLocation")
    if not location:
        return {}
    data = _read_json(Path(location) / ".claude-plugin" / "marketplace.json")
    return {
        p["name"]: p.get("description")
        for p in data.get("plugins", [])
        if isinstance(p, dict) and p.get("name") and p.get("description")
    }


def read_manifest(root: Path) -> dict:
    return _read_json(root / _MANIFEST)


def _is_mod(root: Path, manifest: dict) -> bool:
    declared = manifest.get("hooks") or _HOOKS_FILE
    for source in declared if isinstance(declared, list) else [declared]:
        config = source if isinstance(source, dict) else _read_json(root / source) if isinstance(source, str) else {}
        if config.get("modules"):
            return True
    return False


def _plugin_item(name: str, marketplace: str, root: Path | None, manifest: dict | None = None, **fields) -> dict:
    if manifest is None:
        manifest = read_manifest(root) if root else {}
    return {
        "name": name,
        "marketplace": marketplace,
        **fields,
        "install_path": str(root) if root else None,
        "mod": root is not None and _is_mod(root, manifest),
        "options": bool(manifest.get("userConfig")),
        "local": marketplace == LOCAL_MARKETPLACE,
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
    descriptions: dict[str, dict[str, str]] = {}
    items = []
    for key, installs in installed.items():
        if not isinstance(installs, list) or not installs:
            continue
        name, _, marketplace = key.partition("@")
        info = installs[0]
        if marketplace not in descriptions:
            descriptions[marketplace] = _catalog_descriptions(marketplace)
        path = info.get("installPath")
        items.append(_plugin_item(
            name, marketplace, Path(path) if path else None,
            version=(info.get("version") or "").replace("unknown", "") or None,
            scope=info.get("scope"),
            enabled=bool(enabled.get(key, True)),
            description=descriptions[marketplace].get(name),
        ))
    items += _local_plugins({item["name"] for item in items}, enabled)
    items.sort(key=lambda p: (not p["enabled"], p["name"]))
    return items


def plugin_root(plugin: str) -> Path | None:
    name, _, marketplace = plugin.partition("@")
    if marketplace == LOCAL_MARKETPLACE:
        return next((Path(item["install_path"]) for item in _local_plugins(set(), {}) if item["name"] == name), None)
    installs = _read_json(_INSTALLED_PLUGINS).get("plugins", {}).get(plugin)
    path = installs[0].get("installPath") if isinstance(installs, list) and installs else None
    return Path(path) if path else None


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
    meta = {}
    match = _FRONTMATTER_RE.match(text)
    if match:
        for line in match.group(1).splitlines():
            key, _, value = line.partition(":")
            if key.strip() in ("name", "description"):
                meta[key.strip()] = value.strip().strip("\"'")
    return meta or None


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
                "plugin": f"{plugin['name']}@{plugin['marketplace']}",
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
    known = known_marketplaces()
    info = known.get(name)
    if not isinstance(info, dict):
        raise ValueError("unknown marketplace")
    location = info.get("installLocation")
    if not location:
        return []
    data = _read_json(Path(location) / ".claude-plugin" / "marketplace.json")
    installed = {(p["name"], p["marketplace"]) for p in list_plugins()}
    items = []
    for plugin in data.get("plugins", []):
        if not isinstance(plugin, dict) or not plugin.get("name"):
            continue
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


def _mcp_entry(name: str, label: str, cfg: dict, enabled: bool, source: str, needs_auth: set[str]) -> dict:
    kind = cfg.get("type") or ("http" if cfg.get("url") else "stdio")
    detail = cfg.get("url") or " ".join([cfg.get("command", ""), *cfg.get("args", [])]).strip()
    return {
        "name": name,
        "label": label,
        "type": kind,
        "detail": detail or None,
        "enabled": enabled,
        "source": source,
        "status": _MCP_NEEDS_AUTH if name in needs_auth else None,
    }


def _mcp_map(servers: object) -> dict:
    return {name: cfg for name, cfg in servers.items() if isinstance(cfg, dict)} if isinstance(servers, dict) else {}


def _plugin_mcp(root: Path) -> dict:
    declared = read_manifest(root).get("mcpServers")
    if isinstance(declared, dict):
        return _mcp_map(declared)
    data = _read_json(root / (declared if isinstance(declared, str) else _MCP_FILE))
    return _mcp_map(data.get("mcpServers", data))


def _same_folder(first: str, second: str) -> bool:
    return os.path.normcase(os.path.normpath(first)) == os.path.normcase(os.path.normpath(second))


def _declared_mcp(folder: str) -> list[tuple[str, str, dict, bool, str]]:
    config = _read_json(_CLAUDE_JSON)
    projects = config.get("projects")
    local = next(
        (entry for key, entry in projects.items() if isinstance(entry, dict) and _same_folder(key, folder)),
        {},
    ) if isinstance(projects, dict) else {}
    skipped = local.get("disabledMcpjsonServers") or []
    return [
        *((name, name, cfg, True, _MCP_USER_SOURCE) for name, cfg in _mcp_map(config.get("mcpServers")).items()),
        *((name, name, cfg, True, "local") for name, cfg in _mcp_map(local.get("mcpServers")).items()),
        *(
            (name, name, cfg, name not in skipped, "project")
            for name, cfg in _mcp_map(_read_json(Path(folder) / _MCP_FILE).get("mcpServers")).items()
        ),
        *(
            (f"plugin:{plugin['name']}:{name}", name if name == plugin["name"] else joined(plugin["name"], name), cfg, True, "plugin")
            for plugin in list_plugins()
            if plugin["enabled"] and plugin["install_path"]
            for name, cfg in _plugin_mcp(Path(plugin["install_path"])).items()
        ),
    ]


def list_mcp_servers(cwd: str | None = None) -> list[dict]:
    folder = cwd if cwd and Path(cwd).is_dir() else DEFAULT_CWD
    needs_auth = set(_read_json(_MCP_AUTH_CACHE))
    items = [_mcp_entry(*server, needs_auth) for server in _declared_mcp(folder)]
    for name, cfg in claude_manage.disabled_mcp_servers().items():
        if isinstance(cfg, dict) and not any(i["name"] == name for i in items):
            items.append(_mcp_entry(name, name, cfg, False, _MCP_USER_SOURCE, needs_auth))
    items.sort(key=lambda s: (not s["enabled"], s["name"]))
    return items


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
        labels = {_MCP_TOOL_CHARS.sub("_", name): label for name, label, *_ in _declared_mcp(DEFAULT_CWD)}
        for name in connectors if isinstance(connectors, list) else []:
            if isinstance(name, str):
                labels[_MCP_TOOL_CHARS.sub("_", name)] = name.removeprefix(_CLAUDEAI_PREFIX)
        _tool_labels = (version, labels)
    return _tool_labels[1]
