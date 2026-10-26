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

from services import accounts, cli_info, mods, persistent_sessions, todos as todos_store, tool_props, visibility

# How many recent stamped events to retain per session for replay on reconnect.
# A very long disconnect can outrun this; the client then falls back to the
# on-disk transcript via load_history.
OUTBOX_MAX = 5000

STOP_GRACE = 15.0

TAIL_POLL = 1.0

RELOADS = {"reload-plugins": "reload_plugins", "reload-skills": "reload_skills"}

RELOAD_COUNTS = {"plugins": "plugins", "commands": "commands", "agents": "agents", "mcp_servers": "mcpServers"}

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
        self._background = {}
        self._owned = {}
        self._runs = {}
        self._announced = object()
        self._published_id = None
        self._prompt_id = None
        self._prompt_text = ""
        self._transport = None
        self._stopping = False
        self._drained = asyncio.Event()
        self._resident = None
        self.adopter = None
        self._cooldown = None
        self._ending = False
        self._tail = None
        self._tail_counts = {}
        self._tail_stamp = None
        self.shown_size = None
        self._mods = mods.Surface()
        self._mod_asks = {}
        self._mod_lock = asyncio.Lock()
        self._roster_lock = asyncio.Lock()
        self._turn_open = False
        self.turn_start_index = 0

    @property
    def running(self):
        return self._worker is not None and not self._worker.done() and not self._ending

    @property
    def working(self):
        return self.running or bool(self._owned) or bool(self._background)

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
            return "retrying" if self._health == "retrying" else "working"
        if self._health == "failed":
            return "failed"
        return "persistent" if self._resident is not None and self._resident.connected else None

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
            replayed = set()
            for stamped in list(self._outbox):
                if stamped["seq"] > floor and not (since_committed and self._in_transcript(stamped)):
                    await self._send_one(sink, {**stamped, "replay": True})
                    replayed.add(stamped["seq"])
            for entry in list(self._pending.values()):
                event = entry.get("event")
                if event is not None and event["seq"] not in replayed:
                    await self._send_one(sink, {**event, "replay": True})
            if self.running or self.resident_alive:
                for running in list(self._background.values()):
                    await self._send_one(sink, {**running, "channel": self.channel, "replay": True})
            await self._send_one(sink, self._mods_snapshot())
        self._watch_transcript()

    def _in_transcript(self, stamped):
        started = self._runs.get(stamped.get("parent"))
        return started is not None and started <= self._committed_seq

    async def detach(self, sink):
        """Drop one socket. The worker keeps running — it is not cancelled,
        and pending permission waits are left intact. Other attached sockets keep
        receiving."""
        async with self._lock:
            self._sinks.pop(sink, None)
        if not self._sinks:
            self._schedule_cooldown()

    def _watch_transcript(self):
        if not self.resident_alive or (self._tail is not None and not self._tail.done()):
            return
        self._rebase_tail()
        self._tail = asyncio.create_task(self._tail_loop())

    def _rebase_tail(self):
        self._tail_counts = {}
        self._tail_stamp = None
        self.shown_size = None

    def _tail_groups(self):
        groups = {}
        for sink, holder in list(self._sinks.items()):
            prefs = (holder or {}).get("prefs") or visibility.defaults()
            groups.setdefault(json.dumps(prefs, sort_keys=True), (prefs, []))[1].append(sink)
        return groups

    async def _tail_loop(self):
        from services import sessions as sessions_service

        try:
            while self._sinks and self.resident_alive:
                await asyncio.sleep(TAIL_POLL)
                if self.running or not self._sinks:
                    continue
                sid, cwd = self.state.session_id, self.state.cwd
                if not sid or not cwd:
                    continue
                project_key = sessions_service.project_key_for(cwd)
                stamp = sessions_service.transcript_stamp(project_key, sid)
                if stamp is None or stamp == self._tail_stamp:
                    continue
                self._tail_stamp = stamp
                groups = self._tail_groups()
                self._tail_counts = {key: count for key, count in self._tail_counts.items() if key in groups}
                for key, (prefs, sinks) in groups.items():
                    items = await asyncio.to_thread(sessions_service.get_session_messages, project_key, sid, prefs)
                    if self.running:
                        break
                    known, self._tail_counts[key] = self._tail_counts.get(key), len(items)
                    if known is None or len(items) <= known:
                        continue
                    self.shown_size = stamp[1]
                    fresh = [dict(item, index=index) for index, item in enumerate(items[known:], start=known)]
                    for sink in sinks:
                        await self._send_one(sink, {"type": "tail", "items": fresh, "channel": self.channel})
        except asyncio.CancelledError:
            return

    async def resident(self, keep=False):
        """The standing client this chat writes to, created on demand while the mode is on, or the running one with ``keep``."""
        if not persistent_sessions.enabled():
            await self.release_resident()
            return None
        self._cancel_cooldown()
        if keep and self.resident_alive:
            return self._resident
        shape = persistent_sessions.shape_of(self.state.cwd, accounts.resolve(self.state.account), self.channel)
        self._resident = await persistent_sessions.pool.take(self.channel, shape)
        self._resident.listener = self._emit
        self._resident.answerer = self._mod_answer
        self._resident.changed = self._resident_changed
        self._resident.runner = self.run_background
        await persistent_sessions.pool.trim(persistent_sessions.limit(), registry.busy_channels() | {self.channel})
        return self._resident

    @property
    def resident_alive(self):
        return self._resident is not None and self._resident.connected

    def _resident_changed(self):
        if not self.resident_alive:
            self._end_background()
            self._reassert_meta()
        self._publish_activity(self.activity)

    async def rename(self, title):
        if self.resident_alive:
            await self._resident.request("rename_session", title=title, source="host")

    def _end_background(self):
        from services import sessions as sessions_service

        for owned in self._owned.values():
            owned.cancel()
        ended = list(self._background)
        self._background.clear()
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        for tool_use_id in ended:
            loop.create_task(self._emit({"type": "agent_result", "id": tool_use_id, "status": sessions_service.TASK_STOPPED}))

    async def run_background(self, tool_use_id, description, work, summary):
        if not self.resident_alive or tool_use_id in self._owned:
            return False
        stamped = await self._emit({"type": "task_running", "id": tool_use_id, "description": description})
        self._runs[tool_use_id] = stamped["seq"]
        self._owned[tool_use_id] = asyncio.create_task(self._run_owned(tool_use_id, work, summary))
        return True

    async def _run_owned(self, tool_use_id, work, summary):
        from services import sessions as sessions_service

        started = time.monotonic()
        try:
            status, result = sessions_service.TASK_COMPLETED, await work(self._emit, self._ask)
        except asyncio.CancelledError:
            status, result = sessions_service.TASK_STOPPED, ""
        except Exception as exc:
            logger.debug(f"background task failed: {type(exc).__name__}: {exc}")
            status, result = sessions_service.TASK_FAILED, str(exc) or type(exc).__name__
        finally:
            self._owned.pop(tool_use_id, None)
        if tool_use_id not in self._background:
            return
        duration_ms = int((time.monotonic() - started) * 1000)
        timings = visibility.ceiling(self.wanted()).get("timings")
        await self._emit({"type": "agent_result", "id": tool_use_id, "status": status, "duration_ms": duration_ms if timings else None})
        notification = sessions_service.task_notification(tool_use_id, status, summary(status), result, duration_ms)
        if self.resident_alive and await self._resident.tell(notification) and not self.running and self.adopter is not None:
            await self.adopter()

    async def reload(self, command, hold=False):
        subtype = RELOADS.get(command)
        if subtype is None:
            return None
        if not self.resident_alive:
            report = {"command": command, "resident": False}
        else:
            answer = await self._resident.reload(subtype, hold)
            if answer is not None and answer.get("held"):
                return {"held": True}
            if answer is None:
                report = {"command": command, "resident": True, "failed": True}
            else:
                counts = {name: len(answer[key]) for name, key in RELOAD_COUNTS.items() if isinstance(answer.get(key), list)}
                report = {"command": command, "resident": True, **counts, "errors": answer.get("error_count") or 0}
        await self._emit({"type": "reloaded", **report})
        return report

    async def release_resident(self):
        self._cancel_cooldown()
        self._resident = None
        self._end_background()
        await persistent_sessions.pool.drop(self.channel)
        self._publish_activity(self.activity)

    async def retire(self):
        from services import sessions as sessions_service

        await self.release_resident()
        sessions_service.forget_pinned(self.state.session_id)

    def _cancel_cooldown(self):
        if self._cooldown is not None:
            self._cooldown.cancel()
            self._cooldown = None

    def _schedule_cooldown(self):
        if self._resident is None:
            return
        self._cancel_cooldown()
        self._cooldown = asyncio.create_task(self._cooldown_loop())

    async def _cooldown_loop(self):
        try:
            while True:
                await asyncio.sleep(persistent_sessions.grace())
                if self._sinks:
                    return
                if self.working:
                    continue
                await self.release_resident()
                return
        except asyncio.CancelledError:
            return

    async def _emit(self, event):
        kind = event.get("type")
        if kind == "own_turn":
            if self.adopter is not None and not self.running:
                asyncio.create_task(self.adopter())
            return None
        if kind == "loose_system":
            from services.claude_runtime import _system_events

            for loose in _system_events(event.get("subtype"), event.get("data"), visibility.ceiling(self.wanted())):
                await self._emit(loose)
            return None
        if kind == "background_tasks":
            alive = set(event.get("ids") or [])
            gone = [tool_use_id for tool_use_id, running in self._background.items() if running.get("task") and running["task"] not in alive]
            for tool_use_id in gone:
                await self._emit({"type": "agent_result", "id": tool_use_id, "status": None})
            return None
        if kind == "commands":
            cli_info.refresh_later(self.state.account)
            await self._send({**event, "channel": self.channel})
            return None
        if kind in mods.STATE_EVENTS:
            self._mods.apply(event)
            await self._send(self._mods_snapshot())
            return None
        if kind in mods.LIVE_EVENTS:
            await self._send({**event, "channel": self.channel})
            return None
        async with self._lock:
            if kind == "notice" and not self._turn_open:
                await self._send(self._loose_notice(event))
                return None
            self._seq += 1
            stamped = {**event, "seq": self._seq, "channel": self.channel}
            if kind == "todos":
                todos_store.remember(self.state.session_id, event.get("items") or [])
            if kind != "command":
                self._outbox.append(stamped)
            if kind in ("done", "interrupted"):
                self._committed_seq = self._seq
                self._turn_open = False
            elif not self.running:
                self._committed_seq = self._seq
            await self._send(stamped)
        self._track(event)
        return stamped

    def _mods_snapshot(self):
        return {**self._mods.snapshot(), "channel": self.channel}

    def _loose_notice(self, event):
        """A notice after the turn: a line the transcript keeps travels as a tail item, a log line unstamped."""
        if not event.get("uuid"):
            return {**event, "channel": self.channel}
        self._tail_counts = {key: count + 1 for key, count in self._tail_counts.items()}
        return {"type": "tail", "items": [event], "channel": self.channel}

    def _mod_client(self):
        resident = self._resident
        if resident is None or not resident.connected or not self._mods.attached:
            return None
        return resident.client

    async def mod_render(self, component, instance_id, props, columns, rows, offset):
        client = self._mod_client()
        if client is None:
            return None
        pane = next((pane for pane in self._mods.panes if pane.get("id") == instance_id), None)
        site = {
            "title": (pane or {}).get("title") or instance_id,
            "focused": self._mods.focused_id == instance_id,
            "working": self.running,
            "columns": columns,
            "rows": rows,
            "offset": offset,
        }
        sent = tool_props.to_engine(component, props)
        drawn = await mods.render(client, component, instance_id, sent, site)
        return {**drawn, "props": tool_props.to_page(component, props, sent, drawn["props"])}

    async def mod_client_module(self, plugin):
        client = self._mod_client()
        return await mods.client_module(client, plugin) if client is not None else None

    async def _mod_answer(self, subtype, data):
        """Ask the attached clients what the CLI wants from the surface; the first answer that settles it wins."""
        request = mods.request_event(subtype, data)
        if request is None or not self._sinks:
            return None
        ask = {"future": asyncio.get_running_loop().create_future(), "kind": request["kind"], "pending": len(self._sinks)}
        self._mod_asks[request["id"]] = ask
        try:
            await self._send({**request, "channel": self.channel})
            return await asyncio.wait_for(asyncio.shield(ask["future"]), mods.ANSWER_TIMEOUT)
        except asyncio.TimeoutError:
            return None
        finally:
            self._mod_asks.pop(request["id"], None)

    def answer_mod(self, rid, answer):
        ask = self._mod_asks.get(rid)
        if ask is None or ask["future"].done():
            return False
        ask["pending"] -= 1
        settled = mods.settled(ask["kind"], answer)
        if settled is not None:
            ask["future"].set_result(settled)
        elif ask["pending"] <= 0:
            ask["future"].set_result(None)
        return True

    async def mod_act(self, action, fields):
        client = self._mod_client()
        if client is None:
            return None
        async with self._roster_lock if action in mods.ROSTER_ACTIONS else self._mod_lock:
            answer = await mods.act(client, action, fields)
        if answer is None:
            return None
        if action == "site_focus":
            redirect = mods.redirected_focus(fields, answer)
            if redirect is not None:
                await self._emit(redirect)
        elif action in mods.ROSTER_ACTIONS:
            roster = await mods.panes(client)
            if roster is not None:
                await self._emit(roster)
        return answer

    def _track(self, event):
        kind = event.get("type")
        if kind == "dequeued":
            self._settle_dequeued(event)
            self._publish_queue()
            return
        if kind == "queued":
            self._publish_queue()
            return
        if kind == "task_running":
            self._background[event.get("id")] = {
                "type": "task_running",
                "id": event.get("id"),
                "task": event.get("task"),
                "description": event.get("description"),
            }
            return
        if kind == "agent_result":
            self._background.pop(event.get("id"), None)
            return
        if kind in ("done", "interrupted") and not self.resident_alive:
            self._end_background()
            return
        if kind in ("session_started", "result"):
            self._publish_activity(self.activity)
            return
        if kind == "compacting":
            self._compacting = True
        elif kind == "compacting_ended":
            self._compacting = False
        elif kind == "compact":
            self._compacting = False
            self.turn_start_index = 0
        elif kind == "status":
            self._health = None if event.get("kind") == "ok" else "retrying"
        elif kind == "api_error" and event.get("severity") == "error":
            self._health = "failed"
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

        session_id = self.state.session_id
        resident = self.resident_alive
        if self._published_id and self._published_id != session_id:
            hub.set_activity(self._published_id, None, False)
        self._published_id = session_id
        hub.set_activity(session_id, activity, resident)
        announced = (activity, resident)
        if announced == self._announced:
            return
        self._announced = announced
        try:
            asyncio.get_running_loop().create_task(self._send_activity(activity, resident))
        except RuntimeError:
            pass

    async def _send_activity(self, activity, resident):
        payload = {"type": "activity", "state": activity or "idle", "resident": resident, "channel": self.channel}
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
        self._compacting = False
        self._reassert_meta()

    def _reassert_meta(self):
        from services import sessions as sessions_service

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
        if mid and (mid in self._seen_ids or any(it["id"] == mid for it in self._queued + self._inflight)):
            return False
        # Stamped on arrival: the client renders the bubble when the turn reaches the message,
        # which can be minutes later, and a reattach replays that event later still.
        item = {"id": mid, "text": text, "attachments": list(attachments or []), "ts": int(time.time() * 1000)}
        self._queued.append(item)
        await self._inbox.put(item)
        await self._emit({"type": "queued", "id": mid, "text": text, "ts": item["ts"]})
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
            return await self._withdraw(mid)
        self._queued.remove(item)
        self._cancelled.add(mid)
        self._seen_ids.add(mid)
        await self._emit({"type": "dequeued", "ids": [mid], "text": "", "consumed": 0})
        if self._result_seen and not self._queued and self._unconsumed <= 0:
            self._inbox.put_nowait(_CLOSE)
        return True

    async def _take_back(self, item):
        """Ask the CLI to hand back a message it holds in its own queue, while it has not started on it."""
        resident = self._resident
        if not item.get("cli_uuid") or resident is None or not resident.connected:
            return False
        answer = await mods.request(resident.client, "cancel_async_message", message_uuid=item["cli_uuid"])
        return bool((answer or {}).get("cancelled"))

    async def _withdraw(self, mid):
        item = next((it for it in self._inflight if it["id"] == mid), None)
        if item is None or item.get("taken") or not await self._take_back(item):
            return False
        item["withdrawn"] = True
        self._inflight = [it for it in self._inflight if it is not item]
        self._unconsumed -= 1
        self._seen_ids.add(mid)
        await self._emit({"type": "dequeued", "ids": [mid], "text": "", "consumed": 0})
        self._publish_queue()
        if self._result_seen and not self._queued and self._unconsumed <= 0:
            self._inbox.put_nowait(_CLOSE)
        return True

    async def take_queued(self):
        """Take the next queued item out of the queue so it can run as a fresh turn."""
        item = next((it for it in self._queued if it.get("id") not in self._seen_ids), None)
        if item is None:
            return None
        self._queued.remove(item)
        carried = []
        while not self._inbox.empty():
            try:
                pending = self._inbox.get_nowait()
            except asyncio.QueueEmpty:
                break
            if pending is not _CLOSE and pending is not item:
                carried.append(pending)
        for pending in carried:
            self._inbox.put_nowait(pending)
        self._stopping = False
        self._drained.set()
        self._publish_queue()
        return item

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
        self._prompt_id, self._prompt_text = mid, text
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
        self._ending = False
        self._health = None
        self._transport = None
        self._prompt_id = None
        self._stopping = False
        self._drained.clear()
        self._turn_open = True
        self._worker = asyncio.create_task(self._run(runner_factory))
        self._publish_activity(self.activity)
        for item in carried:
            self._inbox.put_nowait(item)
        self._publish_queue()
        return True

    def set_transport(self, transport):
        self._transport = transport

    async def _send_control(self, subtype: str, **payload) -> bool:
        transport = self._transport
        worker = self._worker
        if transport is None or worker is None or worker.done():
            return False
        request = {
            "type": "control_request",
            "request_id": f"req_{subtype}_{uuid.uuid4().hex[:8]}",
            "request": {"subtype": subtype, **payload},
        }
        try:
            await transport.write(json.dumps(request) + "\n")
        except Exception as exc:
            logger.warning(f"{subtype} request rejected: {type(exc).__name__}: {exc}")
            return False
        return True

    async def _send_stop(self):
        return await self._send_control("interrupt")

    async def set_model(self, model: str | None) -> bool:
        """Retarget the model of the turn already running."""
        return await self._send_control("set_model", model=model)

    async def set_permission_mode(self, mode: str) -> bool:
        return await self._send_control("set_permission_mode", mode=mode)

    async def stop_task(self, tool_use_id: str) -> bool:
        owned = self._owned.get(tool_use_id)
        if owned is not None:
            owned.cancel()
            return True
        running = self._background.get(tool_use_id)
        task_id = running.get("task") if running else None
        if not task_id:
            return False
        if await self._send_control("stop_task", task_id=task_id):
            return True
        client = self._resident.client if self.resident_alive else None
        return client is not None and await mods.request(client, "stop_task", task_id=task_id) is not None

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
        try:
            announced = False
            if self._queued or self._inflight:
                announced = await self._stop_and_continue()
                if announced and (self._drained.is_set() or worker.done()):
                    return
            if not announced:
                self._stopping = True
                if await self._ask_cli_to_stop():
                    return
            undelivered = self._transport is None
            worker.cancel()
            try:
                await worker
            except asyncio.CancelledError:
                pass
            if worker.cancelled():
                await self._reclaim_inflight()
                if undelivered and self._prompt_id:
                    await self._emit({"type": "dequeued", "ids": [self._prompt_id], "text": self._prompt_text, "consumed": 0})
                if not announced:
                    await self._emit({"type": "interrupted"})
        finally:
            self._publish_activity(self.activity)

    async def _stop_and_continue(self):
        """Stop the running answer and wait for the queue to take over. False when the CLI
        never got the request; a turn that goes quiet instead falls back to the hard stop."""
        if not await self._send_stop():
            return False
        self._drained.clear()
        self._stopping = True
        await self._emit({"type": "interrupted"})
        waiter = asyncio.create_task(self._drained.wait())
        try:
            await asyncio.wait([waiter, self._worker], timeout=STOP_GRACE, return_when=asyncio.FIRST_COMPLETED)
        finally:
            waiter.cancel()
        self._stopping = not self._drained.is_set()
        return True

    async def _reclaim_inflight(self):
        """Queue again what the CLI hands back unread; whatever it already holds is never sent twice."""
        returned = [it for it in self._inflight if it.get("id") not in self._seen_ids and await self._take_back(it)]
        self._inflight = [it for it in self._inflight if it not in returned]
        await self._flush_inflight()
        pending = []
        while not self._inbox.empty():
            try:
                it = self._inbox.get_nowait()
            except asyncio.QueueEmpty:
                break
            if it is not _CLOSE:
                pending.append(it)
        self._queued = returned + pending
        for it in self._queued:
            self._inbox.put_nowait(it)
        self._publish_queue()

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
            await self._reclaim_inflight()
            await self._emit({"type": "interrupted" if self._stopping else "done"})
            self._settle()
        else:
            await self._flush_inflight()
            await self._emit({"type": "interrupted" if self._stopping else "done"})
            self._settle()
        finally:
            self._ending = True
            self._rebase_tail()
            self._publish_activity(self.activity)
            if self._sinks:
                self._watch_transcript()
            else:
                self._schedule_cooldown()


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

    async def end_session(self, session_id):
        for channel, session in list(self._sessions.items()):
            if session.state.session_id != session_id:
                continue
            del self._sessions[channel]
            self._idle_since.pop(channel, None)
            await session.interrupt()
            await session.release_resident()

    def residents(self):
        return [session for session in self._sessions.values() if session.resident_alive]

    def live_session_ids(self):
        """Ids of the chats alive in this process, transcript on disk or not yet."""
        return {s.state.session_id for s in self._sessions.values() if s.state.session_id}

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
            if session.working or session.attached:
                self._idle_since.pop(channel, None)
                continue
            since = self._idle_since.setdefault(channel, now)
            if now - since >= self._grace:
                asyncio.create_task(session.retire())
                del self._sessions[channel]
                self._idle_since.pop(channel, None)

    def busy_channels(self):
        return {
            channel for channel, session in self._sessions.items()
            if session.working or session.attached
        }


registry = SessionRegistry()
