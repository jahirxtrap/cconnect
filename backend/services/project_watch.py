"""Live updates for the project explorer over WebSocket.

One recursive watcher per project a client is looking at, started on the first subscriber
and stopped with the last, so nothing runs while the explorer is closed. A burst drops the
git caches of the repositories it touched, every one of them once it is truncated past
`_MAX_PATHS`, and carries the paths.
"""

import asyncio
import threading
from pathlib import Path
from typing import Optional

from loguru import logger
from watchfiles import Change, watch

from core import paths
from services import project_files

_DEBOUNCE_MS = 400
_MAX_PATHS = 200
_GIT_INTERNALS = {"index", "HEAD"}
_STRUCTURE = {Change.added, Change.deleted}


def _inside(root: Path, path: str) -> str:
    try:
        return Path(path).relative_to(root).as_posix()
    except ValueError:
        return ""


def _tracked(path: str) -> bool:
    """Ignored paths are noise, and the backend writes plenty of it inside its own project."""
    target = Path(path)
    if target.is_relative_to(paths.DATA_DIR):
        return False
    parts = target.parts
    if ".git" in parts:
        tail = parts[parts.index(".git") + 1 :]
        return len(tail) == 1 and tail[0] in _GIT_INTERNALS
    repo = project_files.repo_of(target.parent)
    index = project_files.index_of(repo) if repo else None
    if index is None:
        return True
    try:
        folder = target.parent.relative_to(repo).as_posix()
    except ValueError:
        return True
    return folder in ("", ".") or f"{folder}/" in index


def _folders(root: Path, appeared: list[str]) -> list[str]:
    found: dict[str, str] = {}
    for path in appeared:
        inside = _inside(root, path)
        if inside and ".git" not in inside.split("/"):
            found.setdefault(inside.rpartition("/")[0], inside)
    return sorted(found.values())[:_MAX_PATHS]


class ProjectWatchHub:
    def __init__(self):
        self._subscribers: dict[asyncio.Queue, str] = {}
        self._stops: dict[str, threading.Event] = {}
        self._roots: dict[str, Path] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._lifecycle = threading.Lock()

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        with self._lifecycle:
            with self._lock:
                keys = list(self._stops)
            for key in keys:
                self._release(key)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers[queue] = ""
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        with self._lifecycle:
            with self._lock:
                previous = self._subscribers.pop(queue, "")
            self._prune(previous)

    def watch(self, queue: asyncio.Queue, project_key: str):
        with self._lifecycle:
            with self._lock:
                if queue not in self._subscribers:
                    return
                previous = self._subscribers[queue]
                self._subscribers[queue] = project_key
            if previous != project_key:
                self._prune(previous)
                self._acquire(project_key)

    def _watched_by(self, project_key: str) -> int:
        with self._lock:
            return sum(1 for key in self._subscribers.values() if key == project_key)

    def _prune(self, project_key: str):
        if project_key and self._watched_by(project_key) == 0:
            self._release(project_key)

    def _acquire(self, project_key: str):
        if not project_key or project_key in self._stops:
            return
        root = project_files.root_for(project_key)
        if root is None:
            return
        project_files.forget(root)
        stop = threading.Event()
        with self._lock:
            self._stops[project_key] = stop
            self._roots[project_key] = root
        threading.Thread(
            target=self._watch, args=(project_key, root, stop), name=f"project-{root.name}", daemon=True
        ).start()

    def _release(self, project_key: str):
        with self._lock:
            stop = self._stops.pop(project_key, None)
            self._roots.pop(project_key, None)
        if stop is not None:
            stop.set()

    def _watch(self, project_key: str, root: Path, stop: threading.Event):
        try:
            for changes in watch(
                root,
                watch_filter=None,
                debounce=_DEBOUNCE_MS,
                stop_event=stop,
                raise_interrupt=False,
                ignore_permission_denied=True,
            ):
                tracked = [path for _, path in changes if _tracked(path)]
                appeared = [path for change, path in changes if change in _STRUCTURE and not _tracked(path)]
                self._publish(project_key, root, tracked, _folders(root, appeared))
        except Exception as exc:
            logger.info(f"project_watch: {root} cannot be watched ({exc}); the tree needs a refresh")

    def _publish(self, project_key: str, root: Path, changed: list[str], folders: list[str]):
        if not changed and not folders:
            return
        inside = {_inside(root, path) for path in changed}
        truncated = "" in inside or len(inside) > _MAX_PATHS
        touched = sorted({*(path for path in inside if path), *folders})[: _MAX_PATHS * 2]
        project_files.invalidate(None if truncated else [root / path for path in touched])
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            targets = [queue for queue, key in self._subscribers.items() if key == project_key]
        for queue in targets:
            loop.call_soon_threadsafe(queue.put_nowait, {
                "type": "changed",
                "project_key": project_key,
                "paths": touched,
                "truncated": truncated,
            })


hub = ProjectWatchHub()
