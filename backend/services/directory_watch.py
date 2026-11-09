import asyncio
import threading
from pathlib import Path
from typing import Callable, Optional

from loguru import logger
from watchfiles import watch

_DEBOUNCE_MS = 400
_POLL_SECONDS = 2.0


class DirectoryWatchHub:
    def __init__(self, root: Path, snapshot: Callable[[str], dict]):
        self._root = root
        self._snapshot = snapshot
        self._subscribers: dict[asyncio.Queue, str] = {}
        self._sent: dict[asyncio.Queue, dict] = {}
        self._answers: set[asyncio.Task] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._lifecycle = threading.Lock()
        self._halted: Optional[threading.Event] = None

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
            self._sent.pop(q, None)
        self._settle_later()

    def set_path(self, q: asyncio.Queue, path: str):
        with self._lock:
            if q not in self._subscribers:
                return
            self._subscribers[q] = path
        task = asyncio.get_running_loop().create_task(self._answer(q, path))
        self._answers.add(task)
        task.add_done_callback(self._answers.discard)

    async def _answer(self, q: asyncio.Queue, path: str):
        snapshot = await asyncio.to_thread(self._snapshot, path)
        with self._lock:
            if self._subscribers.get(q) != path:
                return
            self._sent[q] = snapshot
        q.put_nowait(snapshot)

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
        if halted is not None:
            halted.set()

    def _begin_watching(self):
        halted = threading.Event()
        self._halted = halted
        threading.Thread(target=self._watch_loop, args=(halted,), name=f"watch-{self._root.name}", daemon=True).start()

    def _watch_loop(self, halted: threading.Event):
        if self._root.is_dir():
            try:
                for _ in watch(
                    self._root,
                    watch_filter=None,
                    debounce=_DEBOUNCE_MS,
                    stop_event=halted,
                    raise_interrupt=False,
                    ignore_permission_denied=True,
                ):
                    self._broadcast()
                return
            except Exception as exc:
                logger.info(f"directory_watch: {self._root} cannot be watched ({exc}); falling back to polling")
        self._poll_loop(halted)

    def _poll_loop(self, halted: threading.Event):
        while not halted.wait(_POLL_SECONDS):
            self._broadcast()

    def _broadcast(self):
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            items = list(self._subscribers.items())
        built: dict[str, dict] = {}
        for q, path in items:
            if path not in built:
                built[path] = self._snapshot(path)
            snapshot = built[path]
            with self._lock:
                if self._subscribers.get(q) != path or self._sent.get(q) == snapshot:
                    continue
                self._sent[q] = snapshot
            loop.call_soon_threadsafe(q.put_nowait, snapshot)
