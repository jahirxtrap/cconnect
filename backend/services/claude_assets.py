"""Read-only views over the local Claude Code installation (plugins, skills, MCP)
plus the user prompt (USER.md) appended after the system context (CCONNECT.md)."""

import json
import re
from pathlib import Path

from services import claude_manage

_CLAUDE_DIR = Path.home() / ".claude"
_USER_PROMPT = Path(__file__).resolve().parent.parent / "prompts" / "USER.md"
_PROJECT_PROMPTS = Path(__file__).resolve().parent.parent / "prompts" / "projects"
_PROJECT_KEY_RE = re.compile(r"^[A-Za-z0-9-]+$")

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def get_user_prompt() -> str:
    try:
        return _USER_PROMPT.read_text(encoding="utf-8")
    except OSError:
        return ""


def set_user_prompt(text: str) -> None:
    _USER_PROMPT.write_text(text, encoding="utf-8")


def get_project_prompt(project_key: str) -> str:
    if not _PROJECT_KEY_RE.match(project_key or ""):
        return ""
    try:
        return (_PROJECT_PROMPTS / f"{project_key}.md").read_text(encoding="utf-8")
    except OSError:
        return ""


def set_project_prompt(project_key: str, text: str) -> None:
    if not _PROJECT_KEY_RE.match(project_key or ""):
        raise ValueError("invalid project key")
    _PROJECT_PROMPTS.mkdir(parents=True, exist_ok=True)
    (_PROJECT_PROMPTS / f"{project_key}.md").write_text(text, encoding="utf-8")


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _enabled_plugins() -> dict:
    data = _read_json(_CLAUDE_DIR / "settings.json").get("enabledPlugins")
    return data if isinstance(data, dict) else {}


def list_marketplaces() -> list[dict]:
    known = _read_json(_CLAUDE_DIR / "plugins" / "known_marketplaces.json")
    items = []
    for name, info in known.items():
        if not isinstance(info, dict):
            continue
        source = info.get("source") or {}
        items.append({
            "name": name,
            "repo": source.get("repo") or source.get("url"),
            "last_updated": info.get("lastUpdated"),
        })
    items.sort(key=lambda m: m["name"])
    return items


def _catalog_descriptions(marketplace: str) -> dict[str, str]:
    known = _read_json(_CLAUDE_DIR / "plugins" / "known_marketplaces.json")
    location = (known.get(marketplace) or {}).get("installLocation")
    if not location:
        return {}
    data = _read_json(Path(location) / ".claude-plugin" / "marketplace.json")
    return {
        p["name"]: p.get("description")
        for p in data.get("plugins", [])
        if isinstance(p, dict) and p.get("name") and p.get("description")
    }


def list_plugins() -> list[dict]:
    installed = _read_json(_CLAUDE_DIR / "plugins" / "installed_plugins.json").get("plugins", {})
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
        items.append({
            "name": name,
            "marketplace": marketplace,
            "version": (info.get("version") or "").replace("unknown", "") or None,
            "scope": info.get("scope"),
            "enabled": bool(enabled.get(key, True)),
            "install_path": info.get("installPath"),
            "description": descriptions[marketplace].get(name),
        })
    items.sort(key=lambda p: (not p["enabled"], p["name"]))
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
    personal = _CLAUDE_DIR / "skills"
    if personal.is_dir():
        for skill_file in sorted(personal.glob("*/SKILL.md")):
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
    if plugin:
        installed = _read_json(_CLAUDE_DIR / "plugins" / "installed_plugins.json").get("plugins", {})
        installs = installed.get(plugin)
        if not isinstance(installs, list) or not installs:
            raise ValueError("unknown plugin")
        return Path(installs[0].get("installPath") or "") / "skills" / skill_id
    return _CLAUDE_DIR / "skills" / skill_id


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
    known = _read_json(_CLAUDE_DIR / "plugins" / "known_marketplaces.json")
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


def _memory_file(scope: str, project_key: str, name: str) -> Path:
    if scope == "global":
        return _CLAUDE_DIR / "CLAUDE.md"
    if scope == "repo":
        root = _project_path(project_key)
        if root is None:
            raise ValueError("unknown project")
        return root / "CLAUDE.md"
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
        if root is not None and (root / "CLAUDE.md").is_file():
            out["project"].append({"scope": "repo", "name": "CLAUDE.md", "description": str(root / "CLAUDE.md")})
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


def list_mcp_servers() -> list[dict]:
    servers = _read_json(Path.home() / ".claude.json").get("mcpServers", {})
    items = []

    def entry(name, cfg, enabled):
        kind = cfg.get("type") or ("http" if cfg.get("url") else "stdio")
        detail = cfg.get("url") or " ".join([cfg.get("command", ""), *cfg.get("args", [])]).strip()
        return {"name": name, "type": kind, "detail": detail or None, "enabled": enabled}

    for name, cfg in servers.items():
        if isinstance(cfg, dict):
            items.append(entry(name, cfg, True))
    for name, cfg in claude_manage.disabled_mcp_servers().items():
        if isinstance(cfg, dict) and not any(i["name"] == name for i in items):
            items.append(entry(name, cfg, False))
    items.sort(key=lambda s: (not s["enabled"], s["name"]))
    return items
