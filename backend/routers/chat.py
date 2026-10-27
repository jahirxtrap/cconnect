"""Interactive chat over WebSocket.

The connection is a detachable transport over a connection-independent
``LiveSession`` (``services/live_sessions``): the running turn lives in the
session's worker, survives the socket dropping, and a reconnecting socket
re-attaches by ``channel`` — getting the current ``running`` state and any
still-pending permission prompt re-emitted.
"""

import asyncio
import json

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import BaseModel, ValidationError

from core import paths
from core.config import DEFAULT_CWD, permission_modes, resolve_permission_mode
from core.responses import api_response
from core.ws import send_event
from mcps import terminal as terminal_mcp
from middleware.public_auth import ws_bearer_ok
from schemas.chat import (
    AgentLoginMessage,
    ModActionMessage,
    ModAnswerMessage,
    ModClientModuleMessage,
    ModRenderMessage,
    PromptMessage,
    SetGenerationMessage,
    SetOptionMessage,
    SetPermissionMessage,
    SetVisibilityMessage,
    StartMessage,
)
from services import accounts
from services import agent_sessions
from services import blocks
from services import chat_list
from services import cli_info
from services import rewind as rewind_service
from services import sessions as sessions_service
from services import settings_store, visibility
from services import todos as todos_store
from services.claude_runtime import run_prompt
from services.live_sessions import registry

router = APIRouter(tags=["Chat"])


class InteractionAnswer(BaseModel):
    id: str
    option_id: str | None = None
    free_text: str | None = None


@router.post("/chat/interaction")
async def answer_interaction(body: InteractionAnswer):
    payload = {"option_id": body.option_id, "free_text": body.free_text, "chat": None}
    session = registry.resolve_interaction(body.id, payload)
    if session is None:
        raise HTTPException(status_code=404, detail="interaction not pending")
    await session.announce_resolved(body.id, body.option_id)
    return api_response()


def _resolve_model(model: str | None) -> str | None:
    """Treat empty / "default" as "let the CLI pick"."""
    return None if model in (None, "", "default") else model


class _Session:
    def __init__(self):
        self.cwd: str = DEFAULT_CWD
        self.permission_mode: str = "default"
        self.session_id: str | None = None
        self.fork: bool = False
        self.account: str | None = None
        self.model: str | None = None
        self.effort: str = "max"
        self.partial: bool = False
        self.agent: str | None = None


def _build_turn_runner(session, text: str, attachments: list[str] | None = None, seed_id: str | None = None, wanted=None, capabilities=None, on_transport=None, adopt=False, shown=None):
    """Build the async-gen factory the LiveSession runs for one prompt. It wraps
    the run_prompt loop plus the post-turn session bookkeeping; the LiveSession
    appends the trailing ``done`` event itself."""
    state: _Session = session.state
    drain = session.drain

    def factory(ask_user, emit):
        async def one(text, attachments, seed_id, drain, request_compact, adopted=False):
            name = text.strip()[:80] if state.session_id is None else None
            compacted = False
            is_compact_cmd = text.strip() == "/compact" or text.strip().startswith("/compact ")
            is_local_cmd = text.strip().startswith("/") and not is_compact_cmd
            boundaries_before = (
                sessions_service.compact_boundary_count(state.cwd, state.session_id)
                if is_compact_cmd and state.cwd and state.session_id else 0
            )
            local_cmds_before = (
                sessions_service.local_command_count(state.cwd, state.session_id)
                if is_local_cmd and state.cwd and state.session_id else 0
            )
            prompt_text, prompt_images = text, None
            if attachments:
                from services import attachments as attachments_service
                prompt_text, prompt_images = attachments_service.compose_prompt(text, attachments)
            resumed_sid = state.session_id
            written_from = (
                sessions_service.session_size(sessions_service.project_key_for(state.cwd), resumed_sid)
                if state.cwd and resumed_sid else 0
            )
            resume_at = rewind_service.get_pending(resumed_sid)
            resident = await session.resident(keep=adopted)
            try:
                async for event in run_prompt(
                    resident=resident,
                    prompt=prompt_text,
                    images=prompt_images,
                    cwd=state.cwd,
                    permission_mode=state.permission_mode,
                    resume=state.session_id,
                    resume_at=resume_at,
                    fork=state.fork,
                    model=_resolve_model(state.model),
                    account=accounts.resolve(state.account),
                    effort=state.effort,
                    partial=state.partial,
                    name=name,
                    ask_user=ask_user,
                    emit=emit,
                    drain=drain() if drain else None,
                    seed_id=seed_id,
                    wanted=wanted,
                    request_compact=request_compact,
                    reload=lambda kind: session.reload(f"reload-{kind}"),
                    capabilities=capabilities,
                    on_transport=on_transport,
                    adopt=adopted,
                    read_from=shown if adopted else None,
                    session_info=lambda: {
                        "session_id": state.session_id,
                        "cwd": state.cwd,
                        "model": _resolve_model(state.model),
                        "account": accounts.resolve(state.account),
                        "effort": _effort_sent(state),
                        "permission_mode": state.permission_mode,
                    },
                ):
                    if event.get("type") == "session_started":
                        state.session_id = event["session_id"]
                        state.fork = False
                    if event.get("type") == "compact":
                        compacted = True
                    if event.get("type") == "result" and event.get("session_id"):
                        state.session_id = event["session_id"]
                        state.fork = False
                        if resume_at and not event.get("is_error"):
                            rewind_service.clear_pending(resumed_sid)
                            chat_list.hub.refresh_session(resumed_sid)
                        if state.cwd and not adopted:
                            sessions_service.record_prompt_history(state.cwd, state.session_id, prompt_text)
                    yield event
            finally:
                if state.cwd and state.session_id:
                    await asyncio.to_thread(
                        sessions_service.normalize_session_entrypoint,
                        state.cwd,
                        state.session_id,
                        written_from if state.session_id == resumed_sid else 0,
                    )
            if state.cwd and state.session_id:
                # The token counts and summary are written to the transcript only after the turn.
                if is_compact_cmd:
                    after = sessions_service.compact_boundary_count(state.cwd, state.session_id)
                    if after > boundaries_before:
                        data = sessions_service.latest_compact(state.cwd, state.session_id)
                        if data:
                            yield {"type": "compact", **data}
                            if data.get("post_tokens"):
                                yield {"type": "context", "context_tokens": data["post_tokens"]}
                elif compacted:
                    data = sessions_service.latest_compact(state.cwd, state.session_id)
                    if data:
                        yield {"type": "compact_summary", **data}
                elif is_local_cmd and sessions_service.local_command_count(state.cwd, state.session_id) > local_cmds_before:
                    md = sessions_service.latest_local_command(state.cwd, state.session_id)
                    if md:
                        yield {"type": "command", "markdown": md}

        def sized(event: dict) -> dict:
            if event.get("type") != "context" or not (state.cwd and state.session_id):
                return event
            weight = sessions_service.request_weight(
                sessions_service.project_key_for(state.cwd), state.session_id
            )
            if weight:
                event["request_bytes"], event["media_bytes"] = weight
            return event

        async def gen():
            pending: dict = {"compact": False, "instructions": ""}

            def request_compact(instructions: str = ""):
                pending["compact"] = True
                pending["instructions"] = instructions

            async for event in one(text, attachments, seed_id, drain, request_compact, adopt):
                yield sized(event)
            if pending["compact"]:
                async for event in one(f"/compact {pending['instructions']}".strip(), None, None, None, None):
                    yield sized(event)
            while (item := await session.take_queued()) is not None:
                await session.commit_user(item["id"], item["text"])
                async for event in one(item["text"], item.get("attachments"), item["id"], drain, request_compact):
                    yield sized(event)

        return gen()

    return factory


def _session_items(session, prefs=None) -> list[dict] | None:
    if not (session.state.session_id and session.state.cwd):
        return None
    try:
        return sessions_service.get_session_messages(
            sessions_service.project_key_for(session.state.cwd), session.state.session_id, prefs)
    except Exception:
        return None


def _turn_start(session, prefs=None) -> int:
    items = _session_items(session, prefs)
    return sessions_service.main_count(items) if items else 0


def _committed_index(session, prefs=None) -> int | None:
    items = _session_items(session, prefs) if session.running and session.agent is None else None
    return None if items is None else sessions_service.committed_index(items, session.turn_start_index)


async def _start_turn(session, mid, text, attachments, prefs=None, capabilities=None):
    if session.agent is not None:
        if not session.start(agent_sessions.runner(session, session.agent, text, attachments or [], mid), seed_id=mid):
            return False
        if mid:
            await session.commit_user(mid, text)
        return True
    turn_start = _turn_start(session, prefs)
    if not session.start(
        _build_turn_runner(session, text, attachments, seed_id=mid, wanted=lambda: visibility.ceiling(session.wanted()), capabilities=capabilities, on_transport=session.set_transport),
        seed_id=mid,
        compacting=(text or "").strip().startswith("/compact"),
    ):
        return False
    session.turn_start_index = turn_start
    session.adopter = lambda: _adopt_turn(session, prefs, capabilities)
    if mid:
        await session.commit_user(mid, text)
    return True


async def _adopt_turn(session, prefs=None, capabilities=None):
    """Show a turn the CLI started on its own, such as a prompt a mod submitted, as it runs."""
    turn_start = _turn_start(session, prefs)
    if session.start(
        _build_turn_runner(session, "", wanted=lambda: visibility.ceiling(session.wanted()), capabilities=capabilities, on_transport=session.set_transport, adopt=True, shown=session.shown_size),
    ):
        session.turn_start_index = turn_start


def _effort_sent(state: _Session) -> str:
    if not accounts.provider_for(accounts.resolve(state.account)):
        return state.effort
    levels = cli_info.effort_levels_for(_resolve_model(state.model), state.account)
    return state.effort if state.effort in levels else ""


def _side_model(state: _Session) -> str | None:
    if not accounts.provider_for(accounts.resolve(state.account)):
        return None
    return _resolve_model(state.model)


def _build_side_runner(main_state: _Session, side_state: _Session, question: str, resume_id: str | None, capabilities: list[str]):
    """LiveSession runner for one quick-chat turn: runs the isolated side question (with the
    interaction callback for permissions/AskUserQuestion) and records the side SDK session id
    so it can be resumed/reattached like the main turn. The trailing ``done`` is added by the
    LiveSession itself."""
    def factory(ask_user, emit):
        async def gen():
            from services.claude_runtime import ask_side_question
            context = sessions_service.session_context(main_state.cwd, main_state.session_id or "")
            async for ev in ask_side_question(
                question, context, resume_id,
                partial=settings_store.get("streaming"),
                ask_user=ask_user,
                account=main_state.account,
                permission_mode=main_state.permission_mode,
                model=_side_model(main_state),
                emit=emit,
                capabilities=capabilities,
                session_info=lambda: {
                    "session_id": side_state.session_id,
                    "cwd": str(paths.AI_WORKDIR),
                    "account": accounts.resolve(main_state.account),
                    "permission_mode": main_state.permission_mode,
                },
            ):
                if ev.get("type") == "ask_session" and ev.get("session_id"):
                    side_state.session_id = ev["session_id"]
                yield ev
        return gen()
    return factory


async def _run_usage(send, account: str | None = None, capabilities=None):
    """Send the plan-usage report as a one-off markdown message."""
    from mcps.components import CAPABILITY as COMPONENTS
    from services.usage import CAPABILITY as USAGE, usage_blocks, usage_data, usage_markdown

    try:
        if USAGE in (capabilities or ()):
            await send({"type": "usage", **await usage_data(account), "local": True})
        elif COMPONENTS in (capabilities or ()):
            await send({"type": "component", "blocks": await usage_blocks(account), "local": True})
        else:
            await send({"type": "command", "markdown": await usage_markdown(account), "local": True})
    except Exception as exc:
        logger.debug(f"usage report ended: {type(exc).__name__}: {exc}")


async def _send_mod_tree(send, session, msg: ModRenderMessage):
    """Draw one mod component for the socket that asked."""
    try:
        drawn = await session.mod_render(msg.component, msg.instance_id, msg.props, msg.columns, msg.rows, msg.offset)
        await send({
            "type": "mod_tree",
            "rid": msg.rid,
            "component": msg.component,
            "instance_id": msg.instance_id,
            **(drawn or {"tree": None, "props": None, "hooked": False, "client_modules": {}}),
            "channel": session.channel,
        })
    except Exception as exc:
        logger.debug(f"mod render ended: {type(exc).__name__}: {exc}")


async def _send_mod_reply(send, session, rid: int, work):
    """Run a mod request whose answer the asking socket waits on, and hand the answer back."""
    try:
        answer = await work
    except Exception as exc:
        logger.debug(f"mod request ended: {type(exc).__name__}: {exc}")
        answer = None
    await send({"type": "mod_reply", "rid": rid, "answer": answer, "channel": session.channel})


@router.websocket("/chat/ws")
async def chat_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        # Close before accept() so the handshake is rejected at the HTTP layer.
        await ws.close(code=1008)
        return
    await ws.accept()
    send_lock = asyncio.Lock()
    session = None        # main lane
    side_session = None   # quick-chat lane
    bg_tasks: set = set()  # keep refs so fire-and-forget tasks aren't GC'd mid-run

    async def send(payload: dict):
        async with send_lock:
            await send_event(ws, payload)

    seen = {"prefs": visibility.defaults(), "capabilities": []}
    sink = visibility.sink_for(send, seen)

    def spawn(coro):
        task = asyncio.create_task(coro)
        bg_tasks.add(task)
        task.add_done_callback(bg_tasks.discard)

    try:
        while True:
            try:
                raw = await ws.receive_json()
            except json.JSONDecodeError:
                await send({"type": "error", "message": "invalid JSON"})
                continue
            mtype = raw.get("type")

            if mtype == "start":
                try:
                    msg = StartMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                seen["prefs"] = visibility.resolve(msg.visibility.model_dump() if msg.visibility else None)
                seen["capabilities"] = terminal_mcp.authorize(msg.capabilities, msg.security_key)
                existing = registry.get(msg.channel) if msg.channel else None
                by_session = None
                if existing is None and msg.resume:
                    by_session = registry.get_by_session(msg.resume)
                existing = existing or by_session
                previous = session
                if existing is not None:
                    session = existing
                elif msg.agent:
                    state = _Session()
                    state.agent = msg.agent
                    state.cwd = msg.cwd or DEFAULT_CWD
                    state.session_id = msg.resume
                    session = registry.create(state)
                    agent = agent_sessions.AgentSession(msg.agent, state.cwd, sessions_service.project_key_for(state.cwd))
                    session.bind_agent(agent)
                    spawn(agent.open(msg.resume))
                else:
                    state = _Session()
                    resumed_cwd = sessions_service.find_session_cwd(msg.resume) if msg.resume else None
                    state.cwd = resumed_cwd or msg.cwd or DEFAULT_CWD
                    requested = msg.permission_mode or settings_store.get("permission_mode")
                    state.permission_mode = resolve_permission_mode(requested)
                    state.session_id = msg.resume
                    state.fork = msg.fork
                    state.account = msg.account
                    state.model = msg.model or settings_store.get("model")
                    state.effort = msg.effort or settings_store.get("effort")
                    state.partial = msg.partial if msg.partial is not None else settings_store.get("streaming")
                    session = registry.create(state)
                if previous is not None and previous is not session:
                    await previous.detach(sink)
                await send({
                    "type": "ready",
                    "session_id": session.state.session_id,
                    "project": sessions_service.project_key_for(session.state.cwd or ""),
                    "cwd": session.state.cwd,
                    "account": accounts.resolve(session.state.account),
                    "channel": session.channel,
                    "running": session.running,
                    "activity": session.activity,
                    "resident": session.resident_alive,
                    "resumed": bool(by_session),
                    "committed_count": _committed_index(session, seen["prefs"]) if by_session else None,
                    "queued": session.queued_items(),
                    "agent": session.state.agent,
                })
                if session.agent is not None:
                    await sink({**session.agent.snapshot(), "channel": session.channel})
                    if not msg.last_seq:
                        await sink({**session.agent.history(), "channel": session.channel})
                await session.attach(sink, last_seq=msg.last_seq, since_committed=bool(by_session), prefs=seen)
                if session.agent is not None:
                    if not session.running and session.agent.todos:
                        await send({"type": "todos", "items": session.agent.todos})
                elif not session.running and session.state.session_id:
                    tasks = sessions_service.session_tasks(
                        session.state.session_id,
                        sessions_service.project_key_for(session.state.cwd or ""),
                    )
                    for t in tasks:
                        await send({"type": "task", **t})
                    remembered = todos_store.load(session.state.session_id)
                    if not tasks and remembered:
                        await send({"type": "todos", "items": remembered})
                await send({"type": "attached"})
                side_channel = raw.get("side_channel")
                side_resume = raw.get("side_resume")
                existing_side = registry.get(side_channel) if side_channel else None
                if existing_side is None and side_resume:
                    existing_side = registry.get_by_session(side_resume)
                if existing_side is not None:
                    side_session = existing_side
                    await side_session.attach(send, last_seq=raw.get("side_last_seq") or 0)
                elif not side_channel:
                    side_session = None

            elif mtype == "prompt":
                if session is None:
                    await send({"type": "error", "message": "send 'start' first"})
                    continue
                try:
                    msg = PromptMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                target = registry.get(msg.channel) if msg.channel and msg.channel != session.channel else session
                if target is None:
                    continue
                if target.running:
                    await target.enqueue(msg.id, msg.text, msg.attachments)
                elif msg.id and target.already_consumed(msg.id):
                    await target.consumed(msg.id)
                elif not await _start_turn(target, msg.id, msg.text, msg.attachments, seen["prefs"], seen["capabilities"]):
                    await target.enqueue(msg.id, msg.text, msg.attachments)

            elif mtype == "unqueue":
                mid = raw.get("id")
                if session is not None and isinstance(mid, str):
                    await session.cancel_queued(mid)

            elif mtype == "set_generation":
                try:
                    msg = SetGenerationMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    if msg.cwd is not None and session.state.session_id is None:
                        session.state.cwd = msg.cwd or DEFAULT_CWD
                    if msg.model is not None:
                        session.state.model = msg.model
                        await session.set_model(_resolve_model(msg.model))
                    if msg.effort is not None:
                        session.state.effort = msg.effort
                    if msg.partial is not None:
                        session.state.partial = msg.partial
                    if msg.account is not None:
                        session.state.account = msg.account

            elif mtype == "set_permission_mode":
                try:
                    msg = SetPermissionMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if msg.mode not in permission_modes():
                    await send({"type": "error", "message": f"invalid permission_mode: {msg.mode}"})
                    continue
                if session is not None:
                    session.state.permission_mode = msg.mode
                    await session.set_permission_mode(msg.mode)
                await send({"type": "permission_mode", "mode": msg.mode})

            elif mtype == "set_option":
                try:
                    msg = SetOptionMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None and session.agent is not None:
                    spawn(session.agent.set_option(msg.id, msg.value))

            elif mtype == "agent_login":
                try:
                    msg = AgentLoginMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None and session.agent is not None:
                    spawn(session.agent.login(msg.method))

            elif mtype == "agent_logout":
                if session is not None and session.agent is not None:
                    spawn(session.agent.logout())

            elif mtype == "agent_retry":
                if session is not None and session.agent is not None:
                    session.agent.reopen(signing_in=session.agent.status == agent_sessions.SIGN_IN)

            elif mtype == "history":
                if session is not None and session.agent is not None:
                    await sink({**session.agent.history(), "channel": session.channel})

            elif mtype == "close_resident":
                if session is not None:
                    await session.release_resident()

            elif mtype == "mod_render":
                try:
                    msg = ModRenderMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    spawn(_send_mod_tree(send, session, msg))

            elif mtype == "mod_act":
                try:
                    msg = ModActionMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    work = session.mod_act(msg.action, msg.model_dump(exclude={"type", "action", "rid"}, exclude_unset=True))
                    spawn(work if msg.rid is None else _send_mod_reply(send, session, msg.rid, work))

            elif mtype == "mod_client_module":
                try:
                    msg = ModClientModuleMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    spawn(_send_mod_reply(send, session, msg.rid, session.mod_client_module(msg.plugin)))

            elif mtype == "mod_answer":
                try:
                    msg = ModAnswerMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    session.answer_mod(msg.id, msg.answer)

            elif mtype == "set_visibility":
                try:
                    msg = SetVisibilityMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                seen["prefs"] = visibility.resolve(msg.model_dump(exclude={"type"}))

            elif mtype == "ask":
                question = (raw.get("text") or "").strip()
                if question and session is not None:
                    resume_id = raw.get("resume") if isinstance(raw.get("resume"), str) else None
                    if side_session is None:
                        side_state = _Session()
                        side_state.cwd = session.state.cwd
                        side_state.session_id = resume_id
                        side_session = registry.create(side_state)
                        await side_session.attach(send)
                    if not side_session.start(_build_side_runner(session.state, side_session.state, question, resume_id, seen["capabilities"])):
                        await send({"type": "error", "message": "busy: a side question is already running", "channel": side_session.channel})

            elif mtype == "usage":
                spawn(_run_usage(send, accounts.resolve(session.state.account if session else None), seen["capabilities"]))

            elif mtype == "reload":
                if session is not None:
                    spawn(session.reload(raw.get("command")))

            elif mtype == "interrupt":
                target = side_session if raw.get("lane") == "side" else session
                if target is not None:
                    await target.interrupt()
                    if target is session:
                        item = session.peek_queued()
                        if item is not None:
                            await _start_turn(session, item["id"], item["text"], item["attachments"], seen["prefs"], seen["capabilities"])

            elif mtype == "stop_task":
                tool_use_id = raw.get("id")
                if session is not None and isinstance(tool_use_id, str):
                    await session.stop_task(tool_use_id)

            elif mtype == "interaction_response":
                rid = raw.get("id")
                if isinstance(rid, str):
                    payload = {
                        "option_id": raw.get("option_id"),
                        "free_text": raw.get("free_text"),
                        "values": raw.get("values"),
                        "chat": raw.get("chat"),
                        "dismissed_by": raw.get("dismissed_by"),
                    }
                    for s in (session, side_session):
                        if s is not None and s.resolve(rid, payload):
                            await s.announce_resolved(
                                rid,
                                raw.get("option_id"),
                                values=payload.get("values"),
                                dismissed=bool(raw.get("chat")),
                            )
                            break

            elif mtype == "load_history":
                project = raw.get("project") or (session.state.cwd if session else DEFAULT_CWD)
                sid = raw.get("session_id")
                limit = raw.get("limit") or 200
                before_index = raw.get("before_index")
                if not isinstance(sid, str) or not isinstance(limit, int):
                    await send({"type": "error", "message": "invalid load_history payload"})
                    continue
                if limit < 1 or limit > 500:
                    await send({"type": "error", "message": "invalid limit"})
                    continue
                try:
                    items = sessions_service.get_session_messages(project, sid, seen["prefs"])
                except ValueError as exc:
                    await send({"type": "error", "message": str(exc)})
                    continue
                if blocks.MEDIA_CAPABILITY not in seen["capabilities"]:
                    items = blocks.degrade_items(items)
                total = len(items)
                end = total if before_index is None else max(0, min(before_index, total))
                start = sessions_service.page_start(items, end, limit)
                slice_ = [dict(item, index=i) for i, item in enumerate(items[start:end], start=start)]
                await send({
                    "type": "history_chunk",
                    "session_id": sid,
                    "items": slice_,
                    "start_index": start,
                    "has_more": start > 0,
                })

            elif mtype == "ping":
                await send({"type": "pong"})

            else:
                await send({"type": "error", "message": f"unknown message type: {mtype}"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"chat_ws error: {type(exc).__name__}: {exc}")
    finally:
        # Detach only — the workers keep running so a reconnect can re-attach.
        if session is not None:
            await session.detach(sink)
        if side_session is not None:
            await side_session.detach(send)
