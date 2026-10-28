"""The agents this server talks to over the Agent Client Protocol, installed from the catalog or added by hand."""

import hashlib
import io
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

from core import packages, paths
from core.slugs import slug
from services import agent_registry

REGISTRY = "registry"
CUSTOM = "custom"
ACP = "acp"
COMMAND = "command"
PROTOCOLS = (ACP, COMMAND)
KINDS = (agent_registry.BINARY, agent_registry.PYTHON, agent_registry.NPM)
ARG_LISTS = ("args", "edit_args", "bypass_args", "model_args")
EDITABLE = ("name", "protocol", "purpose", "program", *ARG_LISTS, "user_env", "enabled")
OWNED = ("purpose", "user_env", "enabled")
DOWNLOAD_TIMEOUT = 600.0
INSTALL_TIMEOUT = 900
OUTPUT_TAIL = 2000
ICON = "icon.svg"
WINDOWS = sys.platform == "win32"
ENV_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
REQUIREMENT_END = re.compile(r"[\[=<>!~@ ;]")
ZIP_SUFFIX = ".zip"
TAR_SUFFIXES = (".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz", ".tar")

MISSING = "missing"
REGISTRY_FAILED = "registry"
DOWNLOAD_FAILED = "download"
CHECKSUM_FAILED = "checksum"
INSTALL_FAILED = "install"


class AgentError(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(detail or reason)
        self.reason = reason
        self.detail = detail


def _strings(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _env(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key): str(item) for key, item in value.items() if ENV_NAME.match(str(key))}


def clean(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    ident = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    program = str(raw.get("program") or "").strip()
    source = raw.get("source")
    if not ident or not name or not program or source not in (REGISTRY, CUSTOM):
        return None
    custom = source == CUSTOM
    return {
        "id": ident,
        "name": name,
        "source": source,
        "protocol": raw.get("protocol") if custom and raw.get("protocol") in PROTOCOLS else ACP,
        "description": "" if custom else str(raw.get("description") or "").strip(),
        "purpose": str(raw.get("purpose") or (raw.get("description") if custom else "") or "").strip(),
        "version": str(raw.get("version") or "").strip() or None,
        "kind": raw.get("kind") if raw.get("kind") in KINDS else None,
        "program": program,
        **{key: _strings(raw.get(key)) for key in ARG_LISTS},
        "env": _env(raw.get("env")),
        "user_env": _env(raw.get("user_env")),
        "enabled": raw.get("enabled") is not False,
    }


def load() -> list[dict]:
    try:
        raw = json.loads(paths.AGENTS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [entry for entry in map(clean, raw if isinstance(raw, list) else []) if entry]


def _save(entries: list[dict]) -> list[dict]:
    unique = list({entry["id"]: entry for entry in entries}.values())
    paths.AGENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    paths.AGENTS_FILE.write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")
    return unique


def _upsert(entry: dict) -> dict:
    cleaned = clean(entry)
    if cleaned is None:
        raise AgentError(INSTALL_FAILED, "the agent entry is incomplete")
    _save([*(item for item in load() if item["id"] != cleaned["id"]), cleaned])
    return cleaned


def find(agent_id: str) -> Optional[dict]:
    return next((entry for entry in load() if entry["id"] == agent_id), None)


def enabled() -> list[dict]:
    return [entry for entry in load() if entry["enabled"]]


def usable(agent_id: str) -> Optional[dict]:
    """An enabled agent that speaks the Agent Client Protocol."""
    return next((entry for entry in enabled() if entry["id"] == agent_id and entry["protocol"] == ACP), None)


def folder(agent_id: str) -> Path:
    return paths.AGENTS_DIR / agent_id


def icon_file(agent_id: str) -> Optional[Path]:
    found = folder(agent_id) / ICON
    return found if found.is_file() else None


def launch(agent: dict) -> tuple[list[str], dict[str, str]]:
    env = {**os.environ, **agent["env"], **agent["user_env"]}
    if agent["source"] == CUSTOM:
        program = shutil.which(agent["program"])
        if not program:
            raise AgentError(MISSING, agent["program"])
        return [program, *agent["args"]], env
    target = folder(agent["id"]) / str(agent["version"]) / agent["program"]
    if not target.is_file():
        raise AgentError(MISSING, str(target))
    if agent["kind"] == agent_registry.NPM:
        tools = agent_registry.node_tools()
        if tools is None:
            raise AgentError(agent_registry.NEEDS_NODE)
        return [tools[0], str(target), *agent["args"]], env
    return [str(target), *agent["args"]], env


def _download(url: str) -> bytes:
    try:
        answer = httpx.get(url, timeout=DOWNLOAD_TIMEOUT, follow_redirects=True)
        answer.raise_for_status()
    except httpx.HTTPError as exc:
        raise AgentError(DOWNLOAD_FAILED, str(exc) or url) from None
    return answer.content


def _relative(command: str) -> PurePosixPath:
    path = PurePosixPath(command.replace("\\", "/"))
    parts = [part for part in path.parts if part not in (".", "")]
    if path.is_absolute() or ".." in parts or not parts:
        raise AgentError(INSTALL_FAILED, f"{command} is not a path inside the agent")
    return PurePosixPath(*parts)


def _inside(root: Path, name: str) -> Path:
    target = (root / name).resolve()
    if not target.is_relative_to(root.resolve()):
        raise AgentError(INSTALL_FAILED, f"{name} points outside the agent")
    return target


def _unzip(data: bytes, root: Path) -> None:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for member in archive.infolist():
            _inside(root, member.filename)
        archive.extractall(root)


def _untar(data: bytes, root: Path) -> None:
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            _inside(root, member.name)
            if member.issym() or member.islnk():
                _inside(root, str(PurePosixPath(member.name).parent / member.linkname))
        archive.extractall(root)


def _executable(target: Path) -> None:
    target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _install_binary(spec: dict, root: Path) -> str:
    data = _download(spec["archive"])
    digest = str(spec.get("sha256") or "").lower()
    if digest and hashlib.sha256(data).hexdigest() != digest:
        raise AgentError(CHECKSUM_FAILED, spec["archive"])
    program = _relative(spec["cmd"])
    name = PurePosixPath(urlparse(spec["archive"]).path).name.lower()
    if name.endswith(ZIP_SUFFIX):
        _unzip(data, root)
    elif name.endswith(TAR_SUFFIXES):
        _untar(data, root)
    else:
        (root / program).parent.mkdir(parents=True, exist_ok=True)
        (root / program).write_bytes(data)
    target = root / program
    if not target.is_file():
        raise AgentError(INSTALL_FAILED, f"{program} is not in {name}")
    _executable(target)
    return program.as_posix()


def _run(command: list[str], cwd: Optional[Path] = None, env: Optional[dict[str, str]] = None) -> None:
    try:
        result = packages.run(command, INSTALL_TIMEOUT, cwd, env)
    except (OSError, subprocess.SubprocessError) as exc:
        raise AgentError(INSTALL_FAILED, str(exc)) from None
    if result.returncode != 0:
        raise AgentError(INSTALL_FAILED, (result.stderr or result.stdout or "").strip()[-OUTPUT_TAIL:])


def _script(folder: Path, name: str) -> Path:
    return folder / (f"{name}.exe" if WINDOWS else name)


def _requirement(package: str) -> str:
    """The pip requirement for a uvx package, which may pin its version as name@version."""
    name, pinned, version = package.partition("@")
    return f"{name.strip()}=={version.strip()}" if pinned and name.strip() and "://" not in version else package


def _install_python(spec: dict, root: Path) -> str:
    """Install a uvx package as uvx would run it."""
    requirement = _requirement(spec["package"])
    name = REQUIREMENT_END.split(requirement, maxsplit=1)[0]
    uv = shutil.which("uv")
    if uv:
        scripts = root / "bin"
        _run([uv, "tool", "install", requirement], env={**os.environ, "UV_TOOL_DIR": str(root / "tools"), "UV_TOOL_BIN_DIR": str(scripts)})
    else:
        venv = root / "venv"
        scripts = venv / ("Scripts" if WINDOWS else "bin")
        _run([sys.executable, "-m", "venv", str(venv)])
        _run([str(_script(scripts, "python")), "-m", "pip", "install", requirement])
    program = _script(scripts, name)
    if not program.is_file():
        raise AgentError(INSTALL_FAILED, f"{requirement} installs no {name} command")
    return program.relative_to(root).as_posix()


def _package_name(package: str) -> str:
    return package.rsplit("@", 1)[0] if package.rfind("@") > 0 else package


def _bin_of(manifest: dict, name: str) -> str:
    bins = manifest.get("bin")
    if isinstance(bins, str) and bins:
        return bins
    if isinstance(bins, dict) and bins:
        short = name.rsplit("/", 1)[-1]
        found = bins.get(short) or (next(iter(bins.values())) if len(bins) == 1 else None)
        if isinstance(found, str) and found:
            return found
    raise AgentError(INSTALL_FAILED, f"{name} declares no command to run")


def _install_npm(spec: dict, root: Path) -> str:
    tools = agent_registry.node_tools()
    if tools is None:
        raise AgentError(agent_registry.NEEDS_NODE)
    package = spec["package"]
    name = _package_name(package)
    (root / "package.json").write_text('{"private": true}', encoding="utf-8")
    _run([tools[1], "install", package, "--save-exact", "--no-audit", "--no-fund", "--omit=dev"], root)
    module = root / "node_modules" / Path(*name.split("/"))
    try:
        manifest = json.loads((module / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise AgentError(INSTALL_FAILED, str(exc)) from None
    program = PurePosixPath("node_modules", *name.split("/"), *_relative(_bin_of(manifest, name)).parts)
    if not (root / program).is_file():
        raise AgentError(INSTALL_FAILED, f"{program} is missing")
    return program.as_posix()


INSTALLERS = {
    agent_registry.BINARY: _install_binary,
    agent_registry.PYTHON: _install_python,
    agent_registry.NPM: _install_npm,
}


def _store_icon(item: dict, root: Path) -> None:
    data = agent_registry.icon(item)
    if data:
        (root / ICON).write_bytes(data)


def install(agent_id: str) -> dict:
    """Install or update a catalog agent, keeping only the version it now runs."""
    try:
        item = agent_registry.entry(agent_id)
    except agent_registry.RegistryError as exc:
        raise AgentError(REGISTRY_FAILED, str(exc)) from None
    if item is None:
        raise AgentError(MISSING, agent_id)
    kind, spec, needs = agent_registry.runnable(item)
    if kind is None or spec is None:
        raise AgentError(needs or agent_registry.NEEDS_PLATFORM)
    root = folder(agent_id)
    version = item["version"]
    target = root / version
    shutil.rmtree(target, ignore_errors=True)
    target.mkdir(parents=True)
    try:
        program = INSTALLERS[kind](spec, target)
    except BaseException:
        shutil.rmtree(target, ignore_errors=True)
        raise
    for stale in root.iterdir():
        if stale.is_dir() and stale != target:
            shutil.rmtree(stale, ignore_errors=True)
    _store_icon(item, root)
    previous = find(agent_id)
    return _upsert({
        "id": agent_id,
        "name": item.get("name") or agent_id,
        "source": REGISTRY,
        "description": item.get("description") or "",
        "version": version,
        "kind": kind,
        "program": program,
        "args": spec.get("args"),
        "env": spec.get("env"),
        **({key: previous[key] for key in OWNED} if previous else {}),
    })


def _unique(name: str) -> str:
    base = slug(name) or CUSTOM
    taken = {entry["id"] for entry in load()}
    ident, number = base, 2
    while ident in taken:
        ident, number = f"{base}-{number}", number + 1
    return ident


def add(fields: dict) -> dict:
    """Add an agent by hand: name, protocol, purpose, program, its argument lists and environment."""
    return _upsert({
        **{key: fields.get(key) for key in ("protocol", "purpose", *ARG_LISTS, "user_env")},
        "id": _unique(fields["name"]),
        "name": fields["name"],
        "source": CUSTOM,
        "program": fields["program"],
    })


def update(agent_id: str, changes: dict) -> Optional[dict]:
    found = find(agent_id)
    if found is None:
        return None
    allowed = EDITABLE if found["source"] == CUSTOM else OWNED
    return _upsert({**found, **{key: value for key, value in changes.items() if key in allowed}})


def remove(agent_id: str) -> Optional[dict]:
    found = find(agent_id)
    if found is None:
        return None
    _save([entry for entry in load() if entry["id"] != agent_id])
    shutil.rmtree(folder(agent_id), ignore_errors=True)
    return found


def adopt(entry: dict, protocol: str) -> None:
    """Take in an agent added by hand somewhere else, keeping its id while it is free."""
    if not entry.get("command") or not entry.get("name"):
        return
    taken = find(str(entry.get("id") or ""))
    if taken is not None and taken["program"] == entry["command"]:
        return
    _upsert({
        **{key: entry.get(key) for key in ARG_LISTS},
        "id": entry["id"] if taken is None and entry.get("id") else _unique(entry["name"]),
        "name": entry["name"],
        "source": CUSTOM,
        "protocol": protocol,
        "purpose": entry.get("description") or "",
        "program": entry["command"],
        "enabled": entry.get("enabled") is not False,
    })
