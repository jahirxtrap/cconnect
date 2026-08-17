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

from core.config import DEFAULT_CWD, permission_modes
from core.responses import api_response
from middleware.public_auth import ws_bearer_ok
from schemas.chat import PromptMessage, SetGenerationMessage, SetPermissionMessage, StartMessage
from services import accounts
from services import rewind as rewind_service
from services import sessions as sessions_service
from services import settings_store
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
    payload = {"option_id": body.option_id, "free_text": body.free_text, "answers": None, "chat": None}
    session = registry.resolve_interaction(body.id, payload)
    if session is None:
        raise HTTPException(status_code=404, detail="interaction not pending")
    await session.announce_resolved(body.id, body.option_id)
    return api_response()


def _resolve_model(model: str | None) -> str | None:
    """Treat empty / "default" as "let the CLI pick"."""
    return None if model in (None, "", "default") else model


def _compact_visibility(data: dict) -> dict:
    """Drop the summary when compact visibility is 'label' (block shows stats only)."""
    if settings_store.visibility_mode("compact") == "label":
        return {**data, "summary": ""}
    return data


class _Session:
    def __init__(self):
        self.cwd: str = DEFAULT_CWD
        self.permission_mode: str = "default"
        self.session_id: str | None = None
        self.fork: bool = False
        self.base_url: str | None = None
        self.account: str | None = None
        self.model: str | None = None
        self.effort: str = "max"
        self.partial: bool = False


def _build_turn_runner(state: _Session, drain, text: str, attachments: list[str] | None = None, seed_id: str | None = None):
    """Build the async-gen factory the LiveSession runs for one prompt. It wraps
    the run_prompt loop plus the post-turn session bookkeeping; the LiveSession
    appends the trailing ``done`` event itself."""

    def factory(ask_user, emit):
        async def gen():
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
            resume_at = rewind_service.get_pending(resumed_sid)
            async for event in run_prompt(
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
                base_url=state.base_url,
                emit=emit,
                drain=drain(),
                seed_id=seed_id,
            ):
                if event.get("type") == "compact":
                    compacted = True
                if event.get("type") == "result" and event.get("session_id"):
                    state.session_id = event["session_id"]
                    state.fork = False
                    if resume_at and not event.get("is_error"):
                        rewind_service.clear_pending(resumed_sid)
                    if state.cwd:
                        sessions_service.record_prompt_history(state.cwd, state.session_id, prompt_text)
                yield event
            if state.cwd and state.session_id:
                sessions_service.normalize_session_entrypoint(state.cwd, state.session_id)
                # The token counts and summary are written to the transcript only after the turn.
                if is_compact_cmd:
                    after = sessions_service.compact_boundary_count(state.cwd, state.session_id)
                    if after > boundaries_before:
                        data = sessions_service.latest_compact(state.cwd, state.session_id)
                        if data:
                            yield {"type": "compact", **_compact_visibility(data)}
                            if data.get("post_tokens"):
                                yield {"type": "context", "context_tokens": data["post_tokens"]}
                elif compacted:
                    data = sessions_service.latest_compact(state.cwd, state.session_id)
                    if data:
                        yield {"type": "compact_summary", **_compact_visibility(data)}
                        if data.get("post_tokens"):
                            yield {"type": "context", "context_tokens": data["post_tokens"]}
                elif is_local_cmd and sessions_service.local_command_count(state.cwd, state.session_id) > local_cmds_before:
                    md = sessions_service.latest_local_command(state.cwd, state.session_id)
                    if md:
                        yield {"type": "command", "markdown": md}

        return gen()

    return factory


async def _start_turn(session, mid, text, attachments):
    turn_start = 0
    if session.state.session_id and session.state.cwd:
        try:
            turn_start = len(sessions_service.get_session_messages(
                sessions_service.project_key_for(session.state.cwd), session.state.session_id))
        except Exception:
            turn_start = 0
    if not session.start(_build_turn_runner(session.state, session.drain, text, attachments, seed_id=mid), seed_id=mid):
        return False
    session.turn_start_index = turn_start
    if mid:
        await session.commit_user(mid, text)
    return True


def _build_side_runner(main_state: _Session, side_state: _Session, question: str, resume_id: str | None):
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
            ):
                if ev.get("type") == "ask_session" and ev.get("session_id"):
                    side_state.session_id = ev["session_id"]
                yield ev
        return gen()
    return factory


async def _run_usage(send, account: str | None = None):
    """Send the plan-usage report as a one-off markdown message."""
    from services.usage import usage_markdown

    try:
        md = await usage_markdown(account)
        await send({"type": "command", "markdown": md})
    except Exception as exc:
        logger.debug(f"usage report ended: {type(exc).__name__}: {exc}")


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
            await ws.send_json(payload)

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
                existing = registry.get(msg.channel) if msg.channel else None
                by_session = None
                if existing is None and msg.resume:
                    by_session = registry.get_by_session(msg.resume)
                existing = existing or by_session
                reattaching = existing is not None
                previous = session
                if reattaching:
                    session = existing
                    if msg.base_url:
                        session.state.base_url = msg.base_url
                    session.state.account = msg.account
                else:
                    state = _Session()
                    state.cwd = msg.cwd or DEFAULT_CWD
                    requested = msg.permission_mode or settings_store.get("permission_mode")
                    state.permission_mode = (
                        requested if requested in permission_modes()
                        else settings_store.get("permission_mode")
                    )
                    state.session_id = msg.resume
                    state.fork = msg.fork
                    state.base_url = msg.base_url
                    state.account = msg.account
                    state.model = msg.model or settings_store.get("model")
                    state.effort = msg.effort or settings_store.get("effort")
                    state.partial = msg.partial if msg.partial is not None else settings_store.get("streaming")
                    session = registry.create(state)
                if previous is not None and previous is not session:
                    await previous.detach(send)
                await send({
                    "type": "ready",
                    "session_id": session.state.session_id,
                    "project": sessions_service.project_key_for(session.state.cwd or ""),
                    "channel": session.channel,
                    "running": session.running,
                    "resumed": bool(by_session),
                    "committed_count": session.turn_start_index,
                })
                await session.attach(send, last_seq=msg.last_seq, since_committed=bool(by_session))
                if not session.running and session.state.session_id:
                    tasks = sessions_service.session_tasks(
                        session.state.session_id,
                        sessions_service.project_key_for(session.state.cwd or ""),
                    )
                    for t in tasks:
                        await send({"type": "task", **t})
                    remembered = todos_store.load(session.state.session_id)
                    if not tasks and remembered:
                        await send({"type": "todos", "items": remembered})
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
                if session.running:
                    await session.enqueue(msg.id, msg.text, msg.attachments)
                elif msg.id and session.already_consumed(msg.id):
                    await session.consumed(msg.id)
                elif not await _start_turn(session, msg.id, msg.text, msg.attachments):
                    await session.enqueue(msg.id, msg.text, msg.attachments)

            elif mtype == "set_generation":
                try:
                    msg = SetGenerationMessage(**raw)
                except ValidationError as exc:
                    await send({"type": "error", "message": exc.errors()})
                    continue
                if session is not None:
                    if msg.cwd and session.state.session_id is None:
                        session.state.cwd = msg.cwd
                    if msg.model is not None:
                        session.state.model = msg.model
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
                await send({"type": "permission_mode", "mode": msg.mode})

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
                    if not side_session.start(_build_side_runner(session.state, side_session.state, question, resume_id)):
                        await send({"type": "error", "message": "busy: a side question is already running", "channel": side_session.channel})

            elif mtype == "usage":
                spawn(_run_usage(send, accounts.resolve(session.state.account if session else None)))

            elif mtype == "interrupt":
                target = side_session if raw.get("lane") == "side" else session
                if target is not None:
                    await target.interrupt()
                    if target is session:
                        item = session.peek_queued()
                        if item is not None:
                            await _start_turn(session, item["id"], item["text"], item["attachments"])

            elif mtype == "interaction_response":
                rid = raw.get("id")
                if isinstance(rid, str):
                    payload = {"option_id": raw.get("option_id"), "free_text": raw.get("free_text"), "answers": raw.get("answers"), "chat": raw.get("chat")}
                    for s in (session, side_session):
                        if s is not None and s.resolve(rid, payload):
                            await s.announce_resolved(rid, raw.get("option_id"))
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
                    items = sessions_service.get_session_messages(project, sid)
                except ValueError as exc:
                    await send({"type": "error", "message": str(exc)})
                    continue
                total = len(items)
                end = total if before_index is None else max(0, min(before_index, total))
                start = max(0, end - limit)
                slice_ = [dict(item, index=i) for i, item in enumerate(items[start:end], start=start)]
                await send({
                    "type": "history_chunk",
                    "session_id": sid,
                    "items": slice_,
                    "start_index": start,
                    "has_more": start > 0,
                })

            else:
                await send({"type": "error", "message": f"unknown message type: {mtype}"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error(f"chat_ws error: {type(exc).__name__}: {exc}")
    finally:
        # Detach only — the workers keep running so a reconnect can re-attach.
        if session is not None:
            await session.detach(send)
        if side_session is not None:
            await side_session.detach(send)
