"""Live updates for the project explorer over WebSocket.

One watcher per project a client is looking at, started on the first subscriber and stopped
with the last, so nothing runs while the explorer is closed. It never recurses: it watches the
folders the clients have open, the folders git tracks and the `.git` of each repository, and
starts again when that set changes. A burst drops the git caches of the repositories it
touched, every one of them once it is truncated past `_MAX_PATHS`, and carries the paths.
"""

import asyncio
import threading
from pathlib import Path
from typing import Optional

from loguru import logger
from watchfiles import Change, watch

from core import paths
from services import files, project_files

_DEBOUNCE_MS = 400
_MAX_PATHS = 200
_GIT_FOLDER = ".git"
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
    if _GIT_FOLDER in parts:
        tail = parts[parts.index(_GIT_FOLDER) + 1 :]
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


def _targets(root: Path, folders: frozenset[str]) -> tuple[str, ...]:
    """What to watch without recursion: the open folders, the ones git tracks and the .git of each repository."""
    wanted = {root}
    for folder in folders:
        try:
            files.resolve(root, folder)
        except (OSError, ValueError):
            continue
        wanted.add(root / folder)
    repos = {repo for repo in map(project_files.repo_of, list(wanted)) if repo} | set(project_files._repos_under(root))
    own = project_files.repo_of(root)
    if own is not None:
        tracked = (own / name for name in project_files.index_of(own) or () if name.endswith("/"))
        wanted.update(folder for folder in tracked if folder == root or root in folder.parents)
    wanted.update(repo / _GIT_FOLDER for repo in repos)
    return tuple(sorted(str(folder) for folder in wanted if folder.is_dir()))


def _folders(root: Path, appeared: list[str]) -> list[str]:
    found: dict[str, str] = {}
    for path in appeared:
        inside = _inside(root, path)
        if inside and ".git" not in inside.split("/"):
            found.setdefault(inside.rpartition("/")[0], inside)
    return sorted(found.values())[:_MAX_PATHS]


class ProjectWatchHub:
    def __init__(self):
        self._subscribers: dict[asyncio.Queue, tuple[str, frozenset[str]]] = {}
        self._stops: dict[str, threading.Event] = {}
        self._watching: dict[str, tuple[str, ...]] = {}
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
            self._subscribers[queue] = ("", frozenset())
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        with self._lifecycle:
            with self._lock:
                previous = self._subscribers.pop(queue, ("", frozenset()))[0]
            self._sync(previous)

    def watch(self, queue: asyncio.Queue, project_key: str, folders: frozenset[str] = frozenset()):
        with self._lifecycle:
            with self._lock:
                if queue not in self._subscribers:
                    return
                previous = self._subscribers[queue][0]
                self._subscribers[queue] = (project_key, folders)
            if previous != project_key:
                self._sync(previous)
            self._sync(project_key)

    def _open_folders(self, project_key: str) -> Optional[frozenset[str]]:
        with self._lock:
            held = [folders for key, folders in self._subscribers.values() if key == project_key]
        return frozenset().union(*held) if held else None

    def _sync(self, project_key: str):
        if not project_key:
            return
        folders = self._open_folders(project_key)
        root = project_files.root_for(project_key) if folders is not None else None
        if root is None:
            self._release(project_key)
            return
        if project_key not in self._stops:
            project_files.forget(root)
        targets = _targets(root, folders)
        if self._watching.get(project_key) == targets:
            return
        self._release(project_key)
        stop = threading.Event()
        with self._lock:
            self._stops[project_key] = stop
            self._watching[project_key] = targets
        threading.Thread(
            target=self._watch, args=(project_key, root, targets, stop), name=f"project-{root.name}", daemon=True
        ).start()

    def _release(self, project_key: str):
        with self._lock:
            stop = self._stops.pop(project_key, None)
            self._watching.pop(project_key, None)
        if stop is not None:
            stop.set()

    def _watch(self, project_key: str, root: Path, targets: tuple[str, ...], stop: threading.Event):
        try:
            for changes in watch(
                *targets,
                watch_filter=None,
                debounce=_DEBOUNCE_MS,
                stop_event=stop,
                raise_interrupt=False,
                recursive=False,
                ignore_permission_denied=True,
            ):
                tracked = [path for _, path in changes if _tracked(path)]
                appeared = [path for change, path in changes if change in _STRUCTURE and not _tracked(path)]
                self._publish(project_key, root, tracked, _folders(root, appeared))
                with self._lifecycle:
                    if not stop.is_set():
                        self._sync(project_key)
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
            listeners = [queue for queue, held in self._subscribers.items() if held[0] == project_key]
        for queue in listeners:
            loop.call_soon_threadsafe(queue.put_nowait, {
                "type": "changed",
                "project_key": project_key,
                "paths": touched,
                "truncated": truncated,
            })


hub = ProjectWatchHub()
