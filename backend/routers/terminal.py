"""Shells on the machine running the backend, behind the security key run.py prints."""

import asyncio
import json

from fastapi import APIRouter, Body, Header, WebSocket, WebSocketDisconnect

from core.access import key_matches
from core.responses import api_response
from core.ws import opening_message, refuse, send_event
from services import terminal

router = APIRouter(tags=["terminal"])


def _unlocked(key: str) -> bool:
    return key_matches(key)


@router.get("/terminal/sessions")
def list_sessions(x_security_key: str = Header("")):
    if not _unlocked(x_security_key):
        return api_response(status=403)
    return api_response(data=terminal.listing())


@router.post("/terminal/sessions")
async def open_session(body: dict = Body(default={}), x_security_key: str = Header("")):
    if not _unlocked(x_security_key):
        return api_response(status=403)
    requested = body.get("cwd")
    try:
        created = terminal.create(
            cwd=requested if isinstance(requested, list) else [requested] if requested else None,
            title=body.get("title"),
            cols=int(body.get("cols") or 0),
            rows=int(body.get("rows") or 0),
        )
    except (ValueError, OSError) as exc:
        return api_response(status=400, message=str(exc))
    return api_response(data=created)


@router.delete("/terminal/sessions/{session_id}")
def close_session(session_id: str, x_security_key: str = Header("")):
    if not _unlocked(x_security_key):
        return api_response(status=403)
    if not terminal.close(session_id):
        return api_response(status=404)
    return api_response()


@router.websocket("/terminal/sessions/{session_id}/ws")
async def terminal_ws(ws: WebSocket, session_id: str):
    opening = await opening_message(ws)
    if opening is None:
        return
    term = terminal.get(session_id) if _unlocked(str(opening.get("key") or "")) else None
    if term is None:
        await refuse(ws)
        return

    scrollback, queue = term.attach(int(opening.get("cols") or 0), int(opening.get("rows") or 0))

    async def outgoing():
        while True:
            chunk = await queue.get()
            if chunk is None:
                await send_event(ws, {"type": "exit", "status": term.exit_status})
                return
            await ws.send_bytes(chunk)

    await send_event(ws, {"type": "attached", **terminal.meta(term)})
    if scrollback:
        await ws.send_bytes(scrollback)
    pump = asyncio.create_task(outgoing())
    try:
        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                break
            data = message.get("bytes")
            if data is not None:
                term.write(data)
                continue
            text = message.get("text")
            if not text:
                continue
            payload = json.loads(text)
            if payload.get("type") == "resize":
                term.resize(queue, int(payload.get("cols") or 0), int(payload.get("rows") or 0))
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        pump.cancel()
        term.detach(queue)
