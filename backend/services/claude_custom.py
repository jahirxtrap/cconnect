import asyncio
import os
from pathlib import Path
from typing import Any, Optional

import yaml

from core.display import home_relative
from core.slugs import slug
from services import claude_assets, cli_info, cli_settings

FOLDERS = {"styles": "output-styles", "commands": "commands", "agents": "agents"}
_MANIFEST_KEYS = {"styles": "outputStyles", "commands": "commands", "agents": "agents"}
_USER = "user"
_PROJECT = "project"
_PLUGIN = "plugin"
_BUILTIN = "builtin"
SCOPES = (_USER, _PROJECT)
_ORDER = {
    "styles": (_BUILTIN, _USER, _PROJECT, _PLUGIN),
    "commands": (_USER, _PROJECT, _PLUGIN, _BUILTIN),
    "agents": (_USER, _PROJECT, _PLUGIN, _BUILTIN),
}
_SUFFIX = ".md"
_NAMESPACE = ":"
_DESCRIPTION = "description"
_KEEP_CODING = "keep-coding-instructions"
_ARGUMENT_HINT = "argument-hint"
_ACTIVE_STYLE = "output_style"
_BLANK = {
    "description": None,
    "plugin": None,
    "plugin_name": None,
    "file": None,
    "path": None,
    "keep_coding_instructions": None,
    "model": None,
    "argument_hint": None,
    "body": None,
}


def _same(first: Path, second: Path) -> bool:
    return os.path.normcase(first.resolve()) == os.path.normcase(second.resolve())


def _roots(cwd: Optional[str]) -> dict[str, Optional[Path]]:
    user = claude_assets.CLAUDE_DIR
    project = Path(claude_assets.project_folder(cwd)) / user.name
    return {_USER: user, _PROJECT: None if _same(project, user) else project}


def _folder(kind: str, scope: str, cwd: Optional[str]) -> Path:
    if kind not in FOLDERS or scope not in SCOPES:
        raise ValueError("invalid kind or scope")
    root = _roots(cwd)[scope]
    if root is None:
        raise ValueError("no project folder")
    return (root / FOLDERS[kind]).resolve()


def _text(value: Any) -> Optional[str]:
    text = str(value).strip() if value is not None else ""
    return text or None


def _flag(value: Any) -> bool:
    return value is True or str(value).strip().lower() == "true"


def _entry(name: str, source: str, **fields: Any) -> dict:
    return {**_BLANK, "name": name, "source": source, **fields}


def _name(kind: str, header: dict, file: str) -> str:
    stem = file[: -len(_SUFFIX)]
    if kind == "commands":
        return stem.replace("/", _NAMESPACE)
    return _text(header.get("name")) or stem.rsplit("/", 1)[-1]


def _item(kind: str, path: Path, folder: Path, source: str, plugin: Optional[dict] = None) -> Optional[dict]:
    try:
        header, body = claude_assets.frontmatter(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return None
    file = path.relative_to(folder).as_posix()
    name = _name(kind, header, file)
    return _entry(
        f"{plugin['name']}{_NAMESPACE}{name}" if plugin else name,
        source,
        description=_text(header.get(_DESCRIPTION)),
        plugin=claude_assets.plugin_id(plugin) if plugin else None,
        plugin_name=plugin["name"] if plugin else None,
        file=None if plugin else file,
        path=home_relative(path),
        keep_coding_instructions=_flag(header.get(_KEEP_CODING)) if kind == "styles" else None,
        model=_text(header.get("model")),
        argument_hint=_text(header.get(_ARGUMENT_HINT)),
        body=None if plugin else body.strip(),
    )


def _files(folder: Path) -> list[Path]:
    return sorted(folder.rglob(f"*{_SUFFIX}")) if folder.is_dir() else []


def _plugin_items(kind: str, plugin: dict) -> list[dict]:
    root = Path(plugin["install_path"])
    declared = claude_assets.manifest_paths(claude_assets.read_manifest(root), _MANIFEST_KEYS[kind], FOLDERS[kind])
    items, seen = [], set()
    for entry in declared:
        if not isinstance(entry, str):
            continue
        target = (root / entry).resolve()
        paths = [target] if target.is_file() and target.suffix == _SUFFIX else _files(target)
        for path in paths:
            if path not in seen:
                seen.add(path)
                items.append(_item(kind, path, target.parent if path == target else target, _PLUGIN, plugin))
    return [item for item in items if item]


def _scope_items(kind: str, roots: dict[str, Optional[Path]]) -> list[dict]:
    items = []
    for scope, root in roots.items():
        folder = (root / FOLDERS[kind]).resolve() if root else None
        items += [item for path in _files(folder) if (item := _item(kind, path, folder, scope))] if folder else []
    return items


def _builtins(kind: str, info: dict, taken: set[str]) -> list[dict]:
    own = cli_info.builtins(info)
    if kind == "styles":
        return [_entry(name, _BUILTIN) for name in cli_info.output_styles(own) if name not in taken]
    if kind == "commands":
        return [
            _entry(entry["name"], _BUILTIN, description=_text(entry.get(_DESCRIPTION)), argument_hint=_text(entry.get("argumentHint")))
            for entry in cli_info.builtin_commands(own)
            if entry["name"] not in taken
        ]
    return [
        _entry(entry["name"], _BUILTIN, description=_text(entry.get(_DESCRIPTION)), model=_text(entry.get("model")))
        for entry in cli_info.agents(own)
        if entry["name"] not in taken
    ]


def _sorted(kind: str, items: list[dict]) -> list[dict]:
    order = _ORDER[kind]
    return sorted(items, key=lambda item: (order.index(item["source"]), item["source"] == _BUILTIN or item["name"].lower()))


def _listing(cwd: Optional[str], info: dict) -> dict:
    roots = _roots(cwd)
    plugins = [plugin for plugin in claude_assets.list_plugins() if plugin["enabled"] and plugin["install_path"]]
    shown, folders = {}, {}
    for kind, folder in FOLDERS.items():
        items = _scope_items(kind, roots) + [item for plugin in plugins for item in _plugin_items(kind, plugin)]
        shown[kind] = _sorted(kind, items + _builtins(kind, info, {item["name"] for item in items}))
        folders[kind] = {scope: home_relative(root / folder) if root else None for scope, root in roots.items()}
    project = roots[_PROJECT]
    return {**shown, "folders": folders, "project": project.parent.name if project else None}


async def listing(cwd: Optional[str]) -> dict:
    return await asyncio.to_thread(_listing, cwd, await cli_info.cached_info())


def _inside(folder: Path, file: str) -> Path:
    path = (folder / file).resolve()
    if not file.endswith(_SUFFIX) or not path.is_relative_to(folder):
        raise ValueError("invalid file")
    return path


def _markdown(header: dict, body: str) -> str:
    front = f"---\n{yaml.safe_dump(header, allow_unicode=True, sort_keys=False, width=1000)}---\n\n" if header else ""
    return f"{front}{body.strip()}\n"


def save(
    kind: str,
    scope: str,
    cwd: Optional[str],
    file: Optional[str],
    name: str,
    description: str,
    keep_coding: bool,
    body: str,
) -> dict:
    folder = _folder(kind, scope, cwd)
    stem, title, summary = slug(name), name.strip(), description.strip()
    if not stem:
        return {"ok": False, "error": "name"}
    if kind == "agents" and not summary:
        return {"ok": False, "error": _DESCRIPTION}
    previous = _inside(folder, file) if file else None
    target = (previous.parent if previous else folder) / f"{stem}{_SUFFIX}"
    if target.exists() and (previous is None or not _same(target, previous)):
        return {"ok": False, "error": "taken"}
    header = claude_assets.frontmatter(previous.read_text(encoding="utf-8"))[0] if previous and previous.is_file() else {}
    former = _name(kind, header, previous.relative_to(folder).as_posix()) if previous else None
    own = {
        **({} if kind == "commands" else {"name": title if kind == "styles" else stem}),
        **({_DESCRIPTION: summary} if summary else {}),
        **({_KEEP_CODING: keep_coding} if kind == "styles" else {}),
    }
    kept = {key: value for key, value in header.items() if key not in own and key != _DESCRIPTION}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(_markdown({**own, **kept}, body), encoding="utf-8")
    if previous and not _same(previous, target):
        previous.unlink(missing_ok=True)
    if kind == "styles" and former and former != title and former == cli_settings.get(_ACTIVE_STYLE):
        cli_settings.set(_ACTIVE_STYLE, title)
    return {"ok": True, "file": target.relative_to(folder).as_posix()}


def delete(kind: str, scope: str, cwd: Optional[str], file: str) -> bool:
    folder = _folder(kind, scope, cwd)
    path = _inside(folder, file)
    if not path.is_file():
        return False
    header = claude_assets.frontmatter(path.read_text(encoding="utf-8"))[0]
    path.unlink()
    if kind == "styles" and _name(kind, header, file) == cli_settings.get(_ACTIVE_STYLE):
        cli_settings.set(_ACTIVE_STYLE, None)
    return True
