"""In-memory live chat sessions decoupled from the WebSocket connection.

A ``LiveSession`` owns the running turn (its worker task), survives the socket
dropping, and lets a reconnecting socket re-attach. The connection becomes a
detachable transport; the work no longer dies with it.
"""

import asyncio
import collections
import json
import time
import uuid

from loguru import logger

from services import todos as todos_store

# How many recent stamped events to retain per session for replay on reconnect.
# A very long disconnect can outrun this; the client then falls back to the
# on-disk transcript via load_history.
OUTBOX_MAX = 5000

STOP_GRACE = 15.0

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
        self._sent = 0
        self._results = 0
        self._result_seen = False
        self._compacting = False
        self._health = None
        self._announced = object()
        self._transport = None
        self._stopping = False
        self._drained = asyncio.Event()
        self.turn_start_index = 0

    @property
    def running(self):
        return self._worker is not None and not self._worker.done()

    @property
    def attached(self):
        return len(self._sinks) > 0

    @property
    def has_replay(self):
        return any(stamped["seq"] > self._committed_seq for stamped in self._outbox)

    @property
    def activity(self):
        if self._pending:
            return "waiting"
        if self.running:
            if self._compacting:
                return "compacting"
            return "slow" if self._health == "slow" else "working"
        return "failed" if self._health == "failed" else None

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
        self._track(event)
        return stamped

    def _track(self, event):
        kind = event.get("type")
        if kind == "dequeued":
            # Settled here, not in _run: the drain announces its own dequeue out-of-band, and
            # leaving that one unaccounted kept the item in _inflight — so the snapshot right
            # after put the chip back on screen next to the bubble it had just drawn.
            self._settle_dequeued(event)
            self._publish_queue()
            return
        if kind == "queued":
            self._publish_queue()
            return
        if kind in ("session_started", "result"):
            self._publish_activity(self.activity)
            return
        if kind == "compacting":
            self._compacting = True
        elif kind == "compact":
            self._compacting = False
        elif kind == "status":
            health = event.get("kind")
            self._health = None if health == "ok" else ("failed" if health == "failed" else "slow")
        else:
            return
        self._publish_activity(self.activity)

    async def _send(self, stamped):
        for sink in list(self._sinks):
            await self._send_one(sink, stamped)

    async def _send_one(self, sink, stamped):
        try:
            await sink(stamped)
        except Exception:
            self._sinks.pop(sink, None)

    def _publish_activity(self, activity):
        from services.chat_list import hub

        hub.set_activity(self.state.session_id, activity)
        if activity == self._announced:
            return
        self._announced = activity
        try:
            asyncio.get_running_loop().create_task(self._send_activity(activity))
        except RuntimeError:
            pass

    async def _send_activity(self, activity):
        payload = {"type": "activity", "state": activity or "idle", "channel": self.channel}
        for sink in list(self._sinks):
            await self._send_one(sink, payload)

    def _settle_dequeued(self, event):
        ids = event.get("ids") or []
        for _id in ids:
            self._seen_ids.add(_id)
        consumed = event.get("consumed", 0)
        self._unconsumed -= consumed
        if consumed:
            self._drained.set()  # the queue is moving: an interrupt can let the turn run on
        if ids:
            done = set(ids)
            self._inflight = [it for it in self._inflight if it.get("id") not in done]

    def _publish_queue(self):
        """The queue lives here, not in each socket: every attached client renders this
        snapshot instead of its own copy, so two devices on one chat can't drift."""
        try:
            asyncio.get_running_loop().create_task(self._send_queue())
        except RuntimeError:
            pass

    async def _send_queue(self):
        payload = {"type": "queue", "items": self.queued_items(), "channel": self.channel}
        for sink in list(self._sinks):
            await self._send_one(sink, payload)

    def _settle(self):
        from services import sessions as sessions_service

        self._compacting = False
        self._publish_activity("failed" if self._health == "failed" else None)
        if self.state.session_id and self.state.cwd:
            sessions_service.reassert_meta(
                sessions_service.project_key_for(self.state.cwd), self.state.session_id
            )

    async def _ask(self, payload):
        """Bridge the SDK's permission/question callback to the client and wait
        for the answer. The wait lives on the session, so it survives reconnects."""
        rid = uuid.uuid4().hex
        future = asyncio.get_running_loop().create_future()
        self._pending[rid] = {"future": future, "event": None}
        self._publish_activity("waiting")
        try:
            self._pending[rid]["event"] = await self._emit(
                {"type": "interaction_request", "id": rid, **payload}
            )
            return await future
        finally:
            self._pending.pop(rid, None)
            self._publish_activity(self.activity)

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
        # An item already drained sits in _inflight and is not in _seen_ids until the CLI
        # writes it: without that check a second client re-sending the same id queues it twice.
        if mid and (mid in self._seen_ids or any(it["id"] == mid for it in self._queued + self._inflight)):
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
            self._sent += 1
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

    def start(self, runner_factory, seed_id=None, compacting=False):
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
        self._sent = 1  # the seed; every drained item adds one
        self._results = 0
        self._cancelled.clear()
        self._result_seen = False
        self._compacting = compacting
        self._health = None
        self._transport = None
        self._stopping = False
        self._drained.clear()
        self._worker = asyncio.create_task(self._run(runner_factory))
        self._publish_activity(self.activity)
        for item in carried:
            self._inbox.put_nowait(item)
        self._publish_queue()
        return True

    def set_transport(self, transport):
        self._transport = transport

    async def _send_stop(self):
        transport = self._transport
        worker = self._worker
        if transport is None or worker is None:
            return False
        request = {
            "type": "control_request",
            "request_id": f"req_stop_{uuid.uuid4().hex[:8]}",
            "request": {"subtype": "interrupt"},
        }
        try:
            await transport.write(json.dumps(request) + "\n")
        except Exception as exc:
            logger.warning(f"interrupt request rejected: {type(exc).__name__}: {exc}")
            return False
        return True

    async def _ask_cli_to_stop(self):
        worker = self._worker
        if not await self._send_stop():
            return False
        try:
            await asyncio.wait_for(asyncio.shield(worker), timeout=STOP_GRACE)
        except asyncio.TimeoutError:
            return False
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        return True

    async def interrupt(self):
        """User-requested stop. Asking the CLI to end the turn is what commits the
        half-written answer; killing the worker is the fallback."""
        worker = self._worker
        if worker is None or worker.done():
            return
        announced = False
        if self._queued or self._inflight:
            # The CLI already holds the queued messages, and they are what keeps this turn
            # open: killing the worker here would stop the answer AND the messages that must
            # run next. Stop the answer, mark the cut, and let the queue carry the turn on.
            announced = await self._stop_and_continue()
            if announced and (self._drained.is_set() or worker.done()):
                return
        if not announced:
            self._stopping = True
            if await self._ask_cli_to_stop():
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
            self._publish_queue()
            if not announced:
                await self._emit({"type": "interrupted"})

    async def _stop_and_continue(self):
        """Stop the running answer and wait for the queue to take over. False when the CLI
        never got the request; a turn that goes quiet instead falls back to the hard stop."""
        if not await self._send_stop():
            return False
        self._drained.clear()
        await self._emit({"type": "interrupted"})
        waiter = asyncio.create_task(self._drained.wait())
        try:
            # asyncio.wait never cancels what it waits on, so the worker is safe here.
            await asyncio.wait([waiter, self._worker], timeout=STOP_GRACE, return_when=asyncio.FIRST_COMPLETED)
        finally:
            waiter.cancel()
        return True

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
                if self._stopping and event.get("type") in ("error", "status"):
                    continue
                await self._emit(event)
                if event.get("type") == "result":
                    self._result_seen = True
                    self._results += 1
                    # The CLI answered every message we sent, so nothing is left to render: an item
                    # still counted as unconsumed never found its transcript entry and would hold
                    # the turn open forever.
                    if self._results >= self._sent and self._unconsumed > 0:
                        await self._flush_inflight()
                    if not self._queued and self._unconsumed <= 0:
                        self._inbox.put_nowait(_CLOSE)
        except asyncio.CancelledError:
            self._settle()
            raise  # interrupt(): stop without a trailing `done`
        except Exception as exc:
            logger.error(f"live session worker failed: {type(exc).__name__}: {exc}")
            if not self._stopping:
                await self._emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            await self._flush_inflight()
            await self._emit({"type": "interrupted" if self._stopping else "done"})
            self._settle()
        else:
            await self._flush_inflight()
            await self._emit({"type": "interrupted" if self._stopping else "done"})
            self._settle()


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

    def committed_cut(self, session_id):
        session = self.get_by_session(session_id)
        if session is None or not session.has_replay:
            return None
        return session.turn_start_index

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
                from services import sessions as sessions_service

                sessions_service.forget_pinned(session.state.session_id)
                del self._sessions[channel]
                self._idle_since.pop(channel, None)


registry = SessionRegistry()
