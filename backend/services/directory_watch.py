"""Live updates for a folder over WebSocket.

A single recursive watcher (``watchdog``, polling fallback) over the folder, started with
the first connection and stopped with the last so nothing runs while nobody looks at it.
Each connection subscribes to one relative directory; on any change the watcher re-lists
every subscriber's directory and pushes the fresh snapshot.
"""

import asyncio
import threading
from pathlib import Path
from typing import Callable, Optional

from loguru import logger

_DEBOUNCE_SECONDS = 0.4
_POLL_SECONDS = 2.0


class DirectoryWatchHub:
    def __init__(self, root: Path, snapshot: Callable[[str], dict]):
        self._root = root
        self._snapshot = snapshot
        self._subscribers: dict[asyncio.Queue, str] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._pending = threading.Event()
        self._stop = threading.Event()
        self._observer = None
        self._started = False

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        self._stop.set()
        self._pending.set()
        if self._observer is not None:
            try:
                self._observer.stop()
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers[q] = ""
            first = len(self._subscribers) == 1
        if first and not self._started:
            self._started = True
            self._stop.clear()
            self._begin_watching()
        return q

    def unsubscribe(self, q: asyncio.Queue):
        with self._lock:
            self._subscribers.pop(q, None)
            idle = not self._subscribers
        if idle and self._started:
            self._started = False
            self.stop()
            self._observer = None

    def set_path(self, q: asyncio.Queue, path: str):
        with self._lock:
            if q not in self._subscribers:
                return
            self._subscribers[q] = path
        q.put_nowait(self._snapshot(path))

    def _begin_watching(self):
        handler = None
        if self._root.is_dir():
            try:
                from watchdog.events import FileSystemEventHandler
                from watchdog.observers import Observer

                hub = self

                class _Handler(FileSystemEventHandler):
                    def on_any_event(self, event):
                        hub._pending.set()

                observer = Observer()
                observer.schedule(_Handler(), str(self._root), recursive=True)
                observer.daemon = True
                observer.start()
                self._observer = observer
                handler = "watchdog"
            except Exception as exc:
                logger.info(f"directory_watch: watchdog unavailable ({exc}); falling back to polling")
        if handler == "watchdog":
            threading.Thread(target=self._debounce_loop, name=f"watch-{self._root.name}", daemon=True).start()
        else:
            threading.Thread(target=self._poll_loop, name=f"poll-{self._root.name}", daemon=True).start()

    def _debounce_loop(self):
        while not self._stop.is_set():
            self._pending.wait()
            if self._stop.is_set():
                return
            self._stop.wait(_DEBOUNCE_SECONDS)
            self._pending.clear()
            self._broadcast()

    def _poll_loop(self):
        while not self._stop.is_set():
            self._stop.wait(_POLL_SECONDS)
            if self._stop.is_set():
                return
            self._broadcast()

    def _broadcast(self):
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            items = list(self._subscribers.items())
        for q, path in items:
            snapshot = self._snapshot(path)
            loop.call_soon_threadsafe(q.put_nowait, snapshot)
