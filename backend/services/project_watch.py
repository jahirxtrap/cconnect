"""Live updates for the project explorer over WebSocket.

One recursive watcher per project a client is looking at, started on the first subscriber
and stopped with the last, so nothing runs while the explorer is closed. A burst drops the
git caches and carries the paths it touched, truncated past `_MAX_PATHS`.
"""

import asyncio
import threading
from pathlib import Path
from typing import Optional

from loguru import logger

from core import paths
from services import project_files

_DEBOUNCE_SECONDS = 0.4
_MAX_PATHS = 200
_GIT_INTERNALS = {"index", "HEAD"}


def _inside(root: Path, path: str) -> str:
    try:
        return Path(path).relative_to(root).as_posix()
    except ValueError:
        return ""


def _relevant(path: str) -> bool:
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


class ProjectWatchHub:
    def __init__(self):
        self._subscribers: dict[asyncio.Queue, str] = {}
        self._observers: dict[str, object] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._pending: dict[str, set[str]] = {}
        self._overflowed: set[str] = set()
        self._timer: Optional[threading.Timer] = None

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        with self._lock:
            keys = list(self._observers)
        for key in keys:
            self._release(key)

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers[queue] = ""
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        with self._lock:
            previous = self._subscribers.pop(queue, "")
        self._prune(previous)

    def watch(self, queue: asyncio.Queue, project_key: str):
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
        if not project_key or project_key in self._observers:
            return
        root = project_files.root_for(project_key)
        if root is None:
            return
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer

            hub = self

            class _Handler(FileSystemEventHandler):
                def on_any_event(self, event):
                    for raw in (event.src_path, getattr(event, "dest_path", "")):
                        if raw and _relevant(str(raw)):
                            hub._touch(project_key, _inside(root, str(raw)))

            observer = Observer()
            observer.schedule(_Handler(), str(root), recursive=True)
            observer.daemon = True
            observer.start()
        except Exception as exc:
            logger.info(f"project_watch: watchdog unavailable ({exc}); the tree needs a refresh")
            return
        with self._lock:
            self._observers[project_key] = observer

    def _release(self, project_key: str):
        with self._lock:
            observer = self._observers.pop(project_key, None)
        if observer is None:
            return
        try:
            observer.stop()
        except Exception:
            pass

    def _touch(self, project_key: str, path: str):
        with self._lock:
            touched = self._pending.setdefault(project_key, set())
            if not path or len(touched) >= _MAX_PATHS:
                self._overflowed.add(project_key)
            else:
                touched.add(path)
            if self._timer is not None:
                return
            self._timer = threading.Timer(_DEBOUNCE_SECONDS, self._flush)
            self._timer.daemon = True
            self._timer.start()

    def _flush(self):
        loop = self._loop
        with self._lock:
            changed = self._pending
            overflowed = self._overflowed
            self._pending = {}
            self._overflowed = set()
            self._timer = None
            targets = [(q, key) for q, key in self._subscribers.items() if key in changed]
        if not changed:
            return
        project_files.invalidate()
        if loop is None:
            return
        for queue, key in targets:
            loop.call_soon_threadsafe(queue.put_nowait, {
                "type": "changed",
                "project_key": key,
                "paths": sorted(changed[key]),
                "truncated": key in overflowed,
            })


hub = ProjectWatchHub()
