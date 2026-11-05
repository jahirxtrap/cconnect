import asyncio
import os
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
_CORES = psutil.cpu_count() or 1

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
    chats = {session.channel: _chat(session, titles, projects, roots) for session in registry.live()}
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
    return {"chats": chats, "pids": pids}


def _tracked_process(process: psutil.Process) -> psutil.Process:
    known = _tracked.get(process.pid)
    if known is not None and known.create_time() == process.create_time():
        return known
    _tracked[process.pid] = process
    return process


def _usage(process: psutil.Process) -> Optional[dict]:
    try:
        tracked = _tracked_process(process)
        with tracked.oneshot():
            return {
                "pid": tracked.pid,
                "name": tracked.name(),
                "cpu": tracked.cpu_percent(None) / _CORES,
                "memory": tracked.memory_info().rss,
                "started": tracked.create_time(),
            }
    except psutil.Error:
        return None


def _channel_of(process: psutil.Process) -> Optional[str]:
    try:
        return process.environ().get(CHANNEL_ENV)
    except psutil.Error:
        return None


def _owner(process: psutil.Process, found: dict) -> dict:
    known = found["pids"].get(process.pid)
    if known is not None:
        return known
    channel = _channel_of(process)
    chat = found["chats"].get(channel) if channel else None
    if chat is not None:
        return chat
    return {"kind": "other", "title": None, "detail": None, "project_key": None, "stop": None}


def _sum(entries: list[dict], field: str) -> float:
    return sum(entry[field] for entry in entries)


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

    items = []
    for process in tops:
        usage = _usage(process)
        if usage is None:
            continue
        listed = [usage, *(entry for entry in (_usage(child) for child in below(process.pid)) if entry is not None)]
        items.append({
            **_owner(process, found),
            **usage,
            "cpu": _sum(listed, "cpu"),
            "memory": _sum(listed, "memory"),
            "processes": sorted(listed, key=lambda entry: entry["memory"], reverse=True),
        })
    own = _usage(server)
    if own is not None:
        items.append({**_SERVER, **own, "processes": [own]})
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
