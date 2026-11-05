import asyncio
import os
import shlex
from typing import Optional

import psutil

from services import browser, chat_list, sessions, terminal
from services.agent_connections import pool as agent_pool
from services.claude_runtime import CHANNEL_ENV
from services.live_sessions import registry

KINDS = ("server", "chat", "agent", "terminal", "browser", "other")
_SERVER = {"kind": "server", "title": None, "detail": None, "project_key": None, "stop": None}
OPEN = "open"
KEYED = "key"
STOPPED = "stopped"
LOCKED = "locked"
UNKNOWN = "unknown"
QUICK_CHAT = "quick_chat"
_CORES = psutil.cpu_count() or 1
_EXE = ".exe"
_SHELLS = frozenset({"bash", "sh", "zsh", "dash", "fish"})
_SHELL_LABEL = "Bash"
_LAUNCHERS = frozenset({"uvx", "uv", "npx", "npm", "pnpm", "bunx", "bun", "yarn", "node", "python", "python3", "py", "deno", "pipx"})
_LAUNCH_WORDS = frozenset({"tool", "run", "exec", "dlx", "x", "uvx"})
_VALUE_FLAGS = frozenset({"--from", "--with", "-p", "--package", "--python", "-c"})
_GENERIC_SCRIPTS = frozenset({"server", "main", "index", "app", "cli", "__main__", "run", "start"})
_NPX_SCRIPTS = frozenset({"npx-cli", "npm-cli"})
_DETAIL_LIMIT = 80

_tracked: dict[int, psutil.Process] = {}


def _folder(path: str) -> str:
    return os.path.normcase(os.path.normpath(path))


def _project_key(cwd: str, roots: list[tuple[str, str]]) -> Optional[str]:
    if not cwd:
        return None
    folder = _folder(cwd)
    for root, key in roots:
        if folder == root or folder.startswith(root.rstrip(os.sep) + os.sep):
            return key
    return sessions.project_key_for(cwd)


def _chat(session, titles: dict, projects: dict, roots: list[tuple[str, str]]) -> dict:
    listed = titles.get(session.state.session_id) or {}
    cwd = session.state.cwd or ""
    return {
        "kind": "chat",
        "title": listed.get("title") or listed.get("preview"),
        "detail": projects.get(cwd) or sessions._project_name(cwd),
        "project_key": _project_key(cwd, roots),
        "activity": session.activity,
        "stop": OPEN,
    }


async def owners() -> dict:
    titles = {item.get("session_id"): item for item in chat_list.hub.sessions()}
    listed = chat_list.hub.projects()
    projects = {item.get("path"): item.get("name") for item in listed}
    roots = sorted(
        ((_folder(item["path"]), item["project_key"]) for item in listed if item.get("path") and item.get("project_key")),
        key=lambda root: len(root[0]),
        reverse=True,
    )
    live = registry.live()
    chats = {session.channel: _chat(session, titles, projects, roots) for session in live}
    sides = {session.channel: session.state.side_of for session in live if session.state.side_of}
    pids: dict[int, dict] = {}
    for connection in agent_pool.connections():
        if connection.pid is not None:
            pids[connection.pid] = {
                "kind": "agent",
                "title": connection.agent.get("name") or connection.agent.get("id"),
                "detail": sessions._project_name(connection.cwd),
                "project_key": _project_key(connection.cwd, roots),
                "stop": OPEN,
            }
    for term in terminal.running():
        pids[term.pid] = {
            "kind": "terminal",
            "title": term.title,
            "detail": term.cwd,
            "project_key": _project_key(term.cwd, roots),
            "stop": KEYED,
        }
    if browser.session.pid is not None:
        pids[browser.session.pid] = {"kind": "browser", "title": None, "detail": None, "project_key": None, "stop": OPEN}
    return {"chats": chats, "sides": sides, "pids": pids}


def _tracked_process(process: psutil.Process) -> psutil.Process:
    known = _tracked.get(process.pid)
    if known is not None and known.create_time() == process.create_time():
        return known
    _tracked[process.pid] = process
    return process


def _own_memory(process: psutil.Process) -> int:
    try:
        info = process.memory_full_info()
    except (psutil.AccessDenied, AttributeError):
        return process.memory_info().rss
    return getattr(info, "pss", info.uss)


def _usage(process: psutil.Process) -> Optional[dict]:
    try:
        tracked = _tracked_process(process)
        with tracked.oneshot():
            return {
                "pid": tracked.pid,
                "name": tracked.name(),
                "cpu": tracked.cpu_percent(None) / _CORES,
                "memory": _own_memory(tracked),
                "started": tracked.create_time(),
            }
    except psutil.Error:
        return None


def _program(token: str) -> str:
    name = token.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1]
    return name[: -len(_EXE)] if name.lower().endswith(_EXE) else name


def _package(spec: str) -> str:
    at = spec.find("@", 1)
    return spec[:at] if at > 0 else spec


def _script(token: str) -> str:
    parts = [part for part in token.replace("\\", "/").split("/") if part]
    if "node_modules" in parts:
        rest = parts[len(parts) - parts[::-1].index("node_modules"):]
        if rest[:1] == [".bin"] and len(rest) > 1:
            return rest[1]
        if rest and rest[0].startswith("@") and len(rest) > 1:
            return f"{rest[0]}/{rest[1]}"
        if rest:
            return rest[0]
    stem = parts[-1].rsplit(".", 1)[0] if parts else token
    return parts[-2] if stem.lower() in _GENERIC_SCRIPTS and len(parts) > 1 else stem


def _shell_command(script: str) -> str:
    try:
        words = shlex.split(script)
    except ValueError:
        words = []
    command = next((words[index + 1] for index, word in enumerate(words[:-1]) if word == "eval"), script)
    return " ".join(command.split())[:_DETAIL_LIMIT]


def _launched(cmdline: list[str], fallback: str) -> tuple[str, Optional[str]]:
    if not cmdline:
        return _program(fallback), None
    program = _program(cmdline[0]).lower()
    args = [arg.replace("^", "") for arg in cmdline[1:]]
    if program == "cmd":
        after = next((args[index + 1:] for index, arg in enumerate(args) if arg.lower() == "/c"), [])
        rest = " ".join(after).split()
        return _launched(rest, rest[0]) if rest else (program, None)
    if program in _SHELLS:
        script = next((args[index + 1] for index, arg in enumerate(args[:-1]) if arg == "-c"), None)
        return (_SHELL_LABEL, _shell_command(script)) if script else (program, None)
    if program not in _LAUNCHERS:
        return _program(fallback), None
    skip = False
    for index, arg in enumerate(args):
        if skip:
            skip = False
            continue
        if arg == "-m" and index + 1 < len(args):
            return args[index + 1], None
        if arg in _VALUE_FLAGS:
            skip = True
            continue
        if arg.startswith("-") or arg in _LAUNCH_WORDS:
            continue
        if arg.startswith("@"):
            return _package(arg), None
        if "/" in arg or "\\" in arg:
            if _program(arg).rsplit(".", 1)[0] in _NPX_SCRIPTS:
                return _launched(["npx", *args[index + 1:]], fallback)
            return _script(arg), None
        return _package(arg), None
    return program, None


def _label(process: psutil.Process) -> tuple[str, Optional[str]]:
    try:
        cmdline = process.cmdline()
        if len(cmdline) == 1 and " " in cmdline[0] and not os.path.exists(cmdline[0]):
            cmdline = cmdline[0].split()
        return _launched(cmdline, process.name())
    except psutil.Error:
        return process.name(), None


def _part(root: psutil.Process, usages: list[dict]) -> dict:
    name, detail = _label(root)
    return {
        "pid": usages[0]["pid"],
        "name": name,
        "detail": detail,
        "cpu": _sum(usages, "cpu"),
        "memory": _sum(usages, "memory"),
        "started": usages[0]["started"],
        "count": len(usages),
    }


def _channel_of(process: psutil.Process) -> Optional[str]:
    try:
        return process.environ().get(CHANNEL_ENV)
    except psutil.Error:
        return None


def _owner(process: psutil.Process, channel: Optional[str], found: dict) -> tuple[int | str, dict]:
    known = found["pids"].get(process.pid)
    if known is not None:
        return process.pid, known
    for key in (found["sides"].get(channel), channel):
        chat = found["chats"].get(key) if key else None
        if chat is not None:
            return key, chat
    return process.pid, {"kind": "other", "title": None, "detail": None, "project_key": None, "stop": None}


def _sum(entries: list[dict], field: str) -> float:
    return sum(entry[field] for entry in entries)


def _by_memory(entry: dict) -> float:
    return entry["memory"]


def snapshot(found: dict) -> dict:
    try:
        server = psutil.Process(os.getpid())
        descendants = server.children(recursive=True)
    except psutil.Error:
        return {"items": [], "total": {"cpu": 0, "memory": 0}}
    alive = {process.pid for process in descendants} | {server.pid}
    for pid in [pid for pid in _tracked if pid not in alive]:
        del _tracked[pid]
    children: dict[int, list[psutil.Process]] = {}
    tops: list[psutil.Process] = []
    for process in descendants:
        try:
            parent = process.ppid()
        except psutil.Error:
            continue
        if parent == server.pid or process.pid in found["pids"]:
            tops.append(process)
        else:
            children.setdefault(parent, []).append(process)

    def below(pid: int) -> list[psutil.Process]:
        found_below = []
        for child in children.get(pid, []):
            found_below.append(child)
            found_below.extend(below(child.pid))
        return found_below

    usages: dict[int, Optional[dict]] = {}

    def usage_of(process: psutil.Process) -> Optional[dict]:
        if process.pid not in usages:
            usages[process.pid] = _usage(process)
        return usages[process.pid]

    def measured(processes: list[psutil.Process]) -> list[dict]:
        return [entry for entry in (usage_of(process) for process in processes) if entry is not None]

    channels = {process.pid: _channel_of(process) for process in tops}
    grouped: dict[int | str, dict] = {}
    for process in sorted(tops, key=lambda top: channels[top.pid] in found["sides"]):
        usage = usage_of(process)
        if usage is None:
            continue
        root = _part(process, [usage])
        if channels[process.pid] in found["sides"]:
            root["role"] = QUICK_CHAT
        parts = [root]
        for child in children.get(process.pid, []):
            branch = measured([child, *below(child.pid)])
            if branch:
                parts.append(_part(child, branch))
        key, owner = _owner(process, channels[process.pid], found)
        item = grouped.setdefault(key, {**owner, **usage, "processes": [], "parts": []})
        item["processes"].extend(measured([process, *below(process.pid)]))
        item["parts"].extend(parts)
    items = [
        {
            **item,
            "cpu": _sum(item["processes"], "cpu"),
            "memory": _sum(item["processes"], "memory"),
            "processes": sorted(item["processes"], key=_by_memory, reverse=True),
            "parts": sorted(item["parts"], key=_by_memory, reverse=True),
        }
        for item in grouped.values()
    ]
    own = usage_of(server)
    if own is not None:
        items.append({**_SERVER, **own, "processes": [own], "parts": [_part(server, [own])]})
    return {
        "items": sorted(items, key=lambda item: (KINDS.index(item["kind"]), item["started"])),
        "total": {"cpu": _sum(items, "cpu"), "memory": _sum(items, "memory")},
    }


def _chat_channel(pid: int) -> Optional[str]:
    try:
        process = next((child for child in psutil.Process(os.getpid()).children(recursive=True) if child.pid == pid), None)
    except psutil.Error:
        return None
    return _channel_of(process) if process is not None else None


async def stop(pid: int, unlocked: bool) -> str:
    for connection in agent_pool.connections():
        if connection.pid == pid:
            await agent_pool.stop(connection)
            return STOPPED
    for term in terminal.running():
        if term.pid == pid:
            if not unlocked:
                return LOCKED
            terminal.close(term.id)
            return STOPPED
    if browser.session.pid == pid:
        await browser.session.stop()
        return STOPPED
    channel = await asyncio.to_thread(_chat_channel, pid)
    session = registry.get(channel) if channel else None
    if session is None:
        return UNKNOWN
    await session.interrupt()
    await session.release_resident()
    return STOPPED
