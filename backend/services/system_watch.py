"""One sampler of machine metrics shared by every connection, replayed from a ring buffer on subscribe."""

import asyncio
import threading
import time
from typing import Optional

from services import processes, system_monitor

_SNAPSHOT_INTERVAL = 2.0
_FIRST_WINDOW = 0.5
_LOG_TAIL_INTERVAL = 0.5
_OWNERS_WAIT = 1.0
_HISTORY_CAP = 90
_LOG_CAP = 300


class SystemWatchHub:
    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._running: Optional[threading.Event] = None
        self._history: list[dict] = []
        self._logs: list[dict] = []
        self._processes: Optional[dict] = None
        self._offset = 0

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        with self._lock:
            running, self._running = self._running, None
        if running is not None:
            running.set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        with self._lock:
            self._subscribers.add(queue)
            replay = {"type": "history", "items": list(self._history), "logs": list(self._logs)}
            listed = self._processes
            started = None
            if self._running is None:
                started = self._running = threading.Event()
        queue.put_nowait(replay)
        if listed is not None:
            queue.put_nowait(listed)
        if started is not None:
            threading.Thread(target=self._sample_loop, args=(started,), name="system-watch", daemon=True).start()
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        with self._lock:
            self._subscribers.discard(queue)
            running = self._running if not self._subscribers else None
            if running is not None:
                self._running = None
                self._history.clear()
                self._processes = None
        if running is not None:
            running.set()

    def _sample_loop(self, stopped: threading.Event):
        system_monitor.prime_cpu()
        next_snapshot = time.monotonic() + _FIRST_WINDOW
        while not stopped.is_set():
            now = time.monotonic()
            if now >= next_snapshot:
                next_snapshot = now + _SNAPSHOT_INTERVAL
                self._push_snapshot()
            self._push_logs()
            stopped.wait(_LOG_TAIL_INTERVAL)

    def _push_snapshot(self):
        try:
            snapshot = system_monitor.snapshot()
        except Exception:
            return
        event = {"type": "system", **snapshot}
        with self._lock:
            self._history.append(event)
            del self._history[:-_HISTORY_CAP]
        self._broadcast(event)
        self._push_processes()

    def _push_processes(self):
        loop = self._loop
        if loop is None:
            return
        try:
            found = asyncio.run_coroutine_threadsafe(processes.owners(), loop).result(_OWNERS_WAIT)
            event = {"type": "processes", **processes.snapshot(found)}
        except Exception:
            return
        with self._lock:
            self._processes = event
        self._broadcast(event)

    def _push_logs(self):
        try:
            chunk = system_monitor.logs(self._offset)
        except Exception:
            return
        self._offset = chunk["offset"]
        items = chunk["items"]
        if not items:
            return
        with self._lock:
            self._logs.extend(items)
            del self._logs[:-_LOG_CAP]
        self._broadcast({"type": "logs", "items": items})

    def _broadcast(self, event: dict):
        loop = self._loop
        if loop is None:
            return
        with self._lock:
            targets = list(self._subscribers)
        for queue in targets:
            loop.call_soon_threadsafe(queue.put_nowait, event)


hub = SystemWatchHub()
