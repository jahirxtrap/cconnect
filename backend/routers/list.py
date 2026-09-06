"""Live chat/project list updates over WebSocket.

A single connection per client: on connect the server sends a ``snapshot`` of the
whole lightweight list, then pushes per-item deltas (``session_changed``,
``session_removed``, ``project_changed``, ``project_removed``) as the projects
directory changes — including edits made externally by the Claude CLI.
"""

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from core.ws import send_event
from middleware.public_auth import ws_bearer_ok
from services.chat_list import hub

router = APIRouter(tags=["List"])


@router.websocket("/list/ws")
async def list_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    queue = hub.subscribe()

    async def pump():
        await send_event(ws, hub.snapshot())
        while True:
            await send_event(ws, await queue.get())

    pump_task = asyncio.create_task(pump())
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"list_ws ended: {type(exc).__name__}: {exc}")
    finally:
        pump_task.cancel()
        hub.unsubscribe(queue)
