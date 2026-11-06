"""One sampler of machine metrics shared by every connection, replayed from a ring buffer on subscribe, with the log pushed as it is written."""

import asyncio
import threading
from typing import Callable, Optional

from services import processes, system_monitor

_SNAPSHOT_INTERVAL = 2.0
_FIRST_WINDOW = 0.5
_OWNERS_WAIT = 1.0
_HISTORY_CAP = 90
_LOG_CAP = 300


def _log_key(entry: dict) -> tuple:
    return entry.get("ts"), entry.get("pid"), entry.get("message")


class SystemWatchHub:
    def __init__(self):
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._running: Optional[threading.Event] = None
        self._history: list[dict] = []
        self._logs: list[dict] = []
        self._processes: Optional[dict] = None
        self._unfollow: Optional[Callable[[], None]] = None

    async def start(self):
        self._loop = asyncio.get_running_loop()

    def stop(self):
        with self._lock:
            running, self._running = self._running, None
        if running is not None:
            running.set()
        self._stop_following()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        if self._unfollow is None:
            self._follow()
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
            self._stop_following()

    def _follow(self):
        with self._lock:
            self._logs = []
        self._unfollow = system_monitor.follow_logs(self._push_log)
        written = system_monitor.logs()["items"]
        with self._lock:
            arrived = {_log_key(entry) for entry in self._logs}
            self._logs = [entry for entry in written if _log_key(entry) not in arrived] + self._logs
            del self._logs[:-_LOG_CAP]

    def _stop_following(self):
        unfollow, self._unfollow = self._unfollow, None
        if unfollow is not None:
            unfollow()

    def _sample_loop(self, stopped: threading.Event):
        system_monitor.prime_cpu()
        wait = _FIRST_WINDOW
        while not stopped.wait(wait):
            self._push_snapshot()
            wait = _SNAPSHOT_INTERVAL

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

    def _push_log(self, entry: dict):
        with self._lock:
            self._logs.append(entry)
            del self._logs[:-_LOG_CAP]
        self._broadcast({"type": "logs", "items": [entry]})

    def _broadcast(self, event: dict):
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        with self._lock:
            targets = list(self._subscribers)
        for queue in targets:
            loop.call_soon_threadsafe(queue.put_nowait, event)


hub = SystemWatchHub()
