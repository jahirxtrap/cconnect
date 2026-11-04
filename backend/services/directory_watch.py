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
        self._lifecycle = threading.Lock()
        self._pending = threading.Event()
        self._halted: Optional[threading.Event] = None
        self._observer = None

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        with self._lifecycle:
            self._halt()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers[q] = ""
        self._settle_later()
        return q

    def unsubscribe(self, q: asyncio.Queue):
        with self._lock:
            self._subscribers.pop(q, None)
        self._settle_later()

    def set_path(self, q: asyncio.Queue, path: str):
        with self._lock:
            if q not in self._subscribers:
                return
            self._subscribers[q] = path
        q.put_nowait(self._snapshot(path))

    def _settle_later(self):
        threading.Thread(target=self._settle, name=f"settle-{self._root.name}", daemon=True).start()

    def _settle(self):
        with self._lifecycle:
            with self._lock:
                wanted = bool(self._subscribers)
            if wanted and self._halted is None:
                self._begin_watching()
            elif not wanted:
                self._halt()

    def _halt(self):
        halted, self._halted = self._halted, None
        observer, self._observer = self._observer, None
        if halted is None:
            return
        halted.set()
        self._pending.set()
        if observer is not None:
            try:
                observer.stop()
            except Exception:
                pass

    def _begin_watching(self):
        halted = threading.Event()
        self._halted = halted
        watching = False
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
                watching = True
            except Exception as exc:
                logger.info(f"directory_watch: watchdog unavailable ({exc}); falling back to polling")
        loop = self._debounce_loop if watching else self._poll_loop
        prefix = "watch" if watching else "poll"
        threading.Thread(target=loop, args=(halted,), name=f"{prefix}-{self._root.name}", daemon=True).start()

    def _debounce_loop(self, halted: threading.Event):
        while not halted.is_set():
            self._pending.wait()
            if halted.is_set() or halted.wait(_DEBOUNCE_SECONDS):
                return
            self._pending.clear()
            self._broadcast()

    def _poll_loop(self, halted: threading.Event):
        while not halted.is_set():
            halted.wait(_POLL_SECONDS)
            if halted.is_set():
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
