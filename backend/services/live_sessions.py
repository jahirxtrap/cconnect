"""In-memory live chat sessions decoupled from the WebSocket connection.

A ``LiveSession`` owns the running turn (its worker task), survives the socket
dropping, and lets a reconnecting socket re-attach. The connection becomes a
detachable transport; the work no longer dies with it.
"""

import asyncio
import collections
import time
import uuid

from loguru import logger

from services import todos as todos_store

# How many recent stamped events to retain per session for replay on reconnect.
# A very long disconnect can outrun this; the client then falls back to the
# on-disk transcript via load_history.
OUTBOX_MAX = 5000

_CLOSE = object()


class LiveSession:
    def __init__(self, channel, state):
        self.channel = channel
        self.state = state
        self._sinks = {}
        self._worker = None
        self._pending = {}  # rid -> {"future": Future, "event": stamped dict | None}
        self._seq = 0
        self._committed_seq = 0
        self._outbox = collections.deque(maxlen=OUTBOX_MAX)
        self._lock = asyncio.Lock()  # serialize emit vs. replay so seq order holds
        self._inbox = asyncio.Queue()
        self._queued = []
        self._inflight = []
        self._seen_ids = set()
        self._cancelled = set()
        self._unconsumed = 0
        self._result_seen = False
        self.turn_start_index = 0

    @property
    def running(self):
        return self._worker is not None and not self._worker.done()

    @property
    def attached(self):
        return len(self._sinks) > 0

    def wanted(self):
        """What the attached sockets asked to see, so a turn never produces detail
        nobody wants (nor buffers it for replay)."""
        return [holder["prefs"] for holder in self._sinks.values() if holder]

    async def attach(self, sink, last_seq=0, since_committed=False, prefs=None):
        """Bind the socket and replay what it missed, then re-emit any still-pending
        permission prompt the client had already passed. ``since_committed`` is for a
        fresh client re-attaching by session id: it already loaded the committed
        transcript, so it only needs the in-progress turn (events after the last done)."""
        async with self._lock:
            self._sinks[sink] = prefs
            floor = max(last_seq, self._committed_seq) if since_committed else last_seq
            for stamped in list(self._outbox):
                if stamped["seq"] > floor:
                    await self._send_one(sink, {**stamped, "replay": True})
            for entry in list(self._pending.values()):
                event = entry.get("event")
                if event is not None and event["seq"] <= last_seq:
                    await self._send_one(sink, {**event, "replay": True})

    async def detach(self, sink):
        """Drop one socket. The worker keeps running — it is not cancelled,
        and pending permission waits are left intact. Other attached sockets keep
        receiving."""
        async with self._lock:
            self._sinks.pop(sink, None)

    async def _emit(self, event):
        async with self._lock:
            self._seq += 1
            stamped = {**event, "seq": self._seq, "channel": self.channel}
            if event.get("type") == "todos":
                todos_store.remember(self.state.session_id, event.get("items") or [])
            if event.get("type") != "command":
                self._outbox.append(stamped)
            if event.get("type") in ("done", "interrupted"):
                self._committed_seq = self._seq
            await self._send(stamped)
            return stamped

    async def _send(self, stamped):
        for sink in list(self._sinks):
            await self._send_one(sink, stamped)

    async def _send_one(self, sink, stamped):
        try:
            await sink(stamped)
        except Exception:
            self._sinks.pop(sink, None)

    async def _ask(self, payload):
        """Bridge the SDK's permission/question callback to the client and wait
        for the answer. The wait lives on the session, so it survives reconnects."""
        rid = uuid.uuid4().hex
        future = asyncio.get_running_loop().create_future()
        self._pending[rid] = {"future": future, "event": None}
        try:
            self._pending[rid]["event"] = await self._emit(
                {"type": "interaction_request", "id": rid, **payload}
            )
            return await future
        finally:
            self._pending.pop(rid, None)

    def resolve(self, rid, response):
        entry = self._pending.get(rid)
        if entry is None or entry["future"].done():
            return False
        entry["future"].set_result(response)
        return True

    async def announce_resolved(self, rid, option_id, values=None, dismissed=False):
        await self._emit({
            "type": "interaction_resolved",
            "id": rid,
            "option_id": option_id,
            "values": values,
            "dismissed": dismissed,
        })

    async def enqueue(self, mid, text, attachments=None):
        if mid and (mid in self._seen_ids or any(it["id"] == mid for it in self._queued)):
            return False
        item = {"id": mid, "text": text, "attachments": list(attachments or [])}
        self._queued.append(item)
        await self._inbox.put(item)
        await self._emit({"type": "queued", "id": mid, "text": text})
        return True

    async def drain(self):
        while True:
            item = await self._inbox.get()
            if item is _CLOSE:
                return
            if item.get("id") and item["id"] in self._cancelled:
                self._cancelled.discard(item["id"])
                continue
            try:
                self._queued.remove(item)
            except ValueError:
                pass
            self._unconsumed += 1
            self._inflight.append(item)
            yield item

    async def cancel_queued(self, mid):
        item = next((it for it in self._queued if it["id"] == mid), None)
        if item is None:
            return False
        self._queued.remove(item)
        self._cancelled.add(mid)
        self._seen_ids.add(mid)
        await self._emit({"type": "dequeued", "ids": [mid], "text": "", "consumed": 0})
        if self._result_seen and not self._queued and self._unconsumed <= 0:
            self._inbox.put_nowait(_CLOSE)
        return True

    def already_consumed(self, mid):
        return bool(mid) and mid in self._seen_ids

    def peek_queued(self):
        return self._queued[0] if self._queued else None

    def queued_items(self):
        return [dict(item) for item in self._inflight + self._queued]

    async def consumed(self, mid):
        if mid:
            self._seen_ids.add(mid)
        await self._emit({"type": "dequeued", "ids": [mid], "text": "", "consumed": 0})

    async def commit_user(self, mid, text):
        if mid:
            self._seen_ids.add(mid)
        if mid and (text or "").strip().startswith("/"):
            await self._emit({"type": "dequeued", "ids": [mid], "text": "", "consumed": 0})

    def start(self, runner_factory, seed_id=None):
        if self.running:
            return False
        carried = []
        while not self._inbox.empty():
            try:
                item = self._inbox.get_nowait()
            except asyncio.QueueEmpty:
                break
            if item is _CLOSE:
                continue
            if seed_id and item.get("id") == seed_id:
                continue
            carried.append(item)
        self._queued = list(carried)
        self._inflight = []
        self._unconsumed = 0
        self._cancelled.clear()
        self._result_seen = False
        self._worker = asyncio.create_task(self._run(runner_factory))
        for item in carried:
            self._inbox.put_nowait(item)
        return True

    async def interrupt(self):
        """User-requested stop. Cancels the worker, waits for it to unwind, then
        emits ``interrupted`` (and no ``done``). A no-op if no turn is running, so
        it never races a naturally-completing turn into a spurious ``interrupted``."""
        worker = self._worker
        if worker is None or worker.done():
            return
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass
        if worker.cancelled():
            leftover = [it for it in self._inflight if it.get("id") not in self._seen_ids]
            self._inflight = []
            self._unconsumed = 0
            if leftover:
                pending = []
                while not self._inbox.empty():
                    try:
                        it = self._inbox.get_nowait()
                    except asyncio.QueueEmpty:
                        break
                    if it is not _CLOSE:
                        pending.append(it)
                self._queued = leftover + pending
                for it in self._queued:
                    self._inbox.put_nowait(it)
            await self._emit({"type": "interrupted"})

    async def _flush_inflight(self):
        stuck = [item["id"] for item in self._inflight if item.get("id")]
        self._inflight = []
        self._unconsumed = 0
        if not stuck:
            return
        self._seen_ids.update(stuck)
        await self._emit({"type": "dequeued", "ids": stuck, "text": "", "consumed": 0})

    async def _run(self, runner_factory):
        try:
            async for event in runner_factory(self._ask, self._emit):
                if event.get("type") == "dequeued":
                    ids = event.get("ids", [])
                    for _id in ids:
                        self._seen_ids.add(_id)
                    self._unconsumed -= event.get("consumed", 0)
                    if ids:
                        done = set(ids)
                        self._inflight = [it for it in self._inflight if it.get("id") not in done]
                await self._emit(event)
                if event.get("type") == "result":
                    self._result_seen = True
                    if not self._queued and self._unconsumed <= 0:
                        self._inbox.put_nowait(_CLOSE)
        except asyncio.CancelledError:
            raise  # interrupt(): stop without a trailing `done`
        except Exception as exc:
            logger.error(f"live session worker failed: {type(exc).__name__}: {exc}")
            await self._emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            await self._flush_inflight()
            await self._emit({"type": "done"})
        else:
            await self._flush_inflight()
            await self._emit({"type": "done"})


class SessionRegistry:
    """Process-global store of live sessions, keyed by channel. Idle sessions
    (not running and with no socket attached) are reaped after ``grace`` seconds."""

    def __init__(self, *, grace=300.0, clock=time.monotonic):
        self._sessions = {}
        self._idle_since = {}
        self._grace = grace
        self._clock = clock

    def create(self, state):
        self._sweep()
        channel = uuid.uuid4().hex
        session = LiveSession(channel, state)
        self._sessions[channel] = session
        return session

    def get(self, channel):
        return self._sessions.get(channel)

    def get_by_session(self, session_id):
        if not session_id:
            return None
        for session in self._sessions.values():
            if session.state.session_id == session_id:
                return session
        return None

    def resolve_interaction(self, rid, response):
        for session in self._sessions.values():
            if session.resolve(rid, response):
                return session
        return None

    def _sweep(self):
        now = self._clock()
        for channel, session in list(self._sessions.items()):
            if session.running or session.attached:
                self._idle_since.pop(channel, None)
                continue
            since = self._idle_since.setdefault(channel, now)
            if now - since >= self._grace:
                del self._sessions[channel]
                self._idle_since.pop(channel, None)


registry = SessionRegistry()
