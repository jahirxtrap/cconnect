"""The browser pane: a Chromium driven over CDP, streamed frame by frame."""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.responses import api_response
from middleware.public_auth import ws_bearer_ok
from services import browser
from services.browser import BrowserSession

router = APIRouter(tags=["browser"])


@router.get("/browser/status")
def status():
    return api_response(data=browser.session.status())


@router.post("/browser/stop")
async def stop():
    await browser.session.stop()
    return api_response(data=browser.session.status())


async def _dispatch(session: BrowserSession, payload: dict):
    kind = payload.get("type")
    if kind == "mouse":
        await session.mouse(payload)
    elif kind == "key":
        await session.key(payload)
    elif kind == "clip":
        await session.clip(payload.get("cut") is True)
    elif kind == "text":
        await session.insert(str(payload.get("value") or ""))
    elif kind == "navigate":
        await session.navigate(str(payload.get("url") or ""))
    elif kind == "reload":
        await session.reload()
    elif kind == "back":
        await session.go(-1)
    elif kind == "forward":
        await session.go(1)
    elif kind == "pick":
        await session.set_picking(payload.get("enabled") is True)
    elif kind == "device":
        await session.set_device(str(payload.get("name") or ""))
    elif kind == "new_tab":
        await session.open_tab(str(payload.get("url") or ""))
    elif kind == "switch_tab":
        await session.switch_tab(str(payload.get("id") or ""))
    elif kind == "reorder":
        await session.reorder([str(item) for item in payload.get("ids") or []])
    elif kind == "close_tab":
        await session.close_tab(str(payload.get("id") or ""))
    elif kind == "resize":
        await session.resize(
            int(payload.get("width") or 0),
            int(payload.get("height") or 0),
            float(payload.get("scale") or 1.0),
        )


@router.websocket("/browser/ws")
async def browser_ws(ws: WebSocket):
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    try:
        opening = await ws.receive_json()
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        return
    if not isinstance(opening, dict):
        await ws.close(code=1008)
        return

    session = browser.session
    queue = session.subscribe()

    async def outgoing():
        while True:
            kind, body = await queue.get()
            if kind == "frame":
                await ws.send_bytes(body)
            else:
                await ws.send_json({"type": kind, **body})

    pump = asyncio.create_task(outgoing())
    try:
        await session.ensure(
            int(opening.get("width") or 0),
            int(opening.get("height") or 0),
            float(opening.get("scale") or 1.0),
        )
    except (RuntimeError, OSError) as exc:
        await ws.send_json({"type": "error", "reason": str(exc)})
    await ws.send_json({"type": "state", **session.status()})

    try:
        while True:
            payload = await ws.receive_json()
            try:
                await _dispatch(session, payload)
            except (RuntimeError, OSError, AttributeError, KeyError) as exc:
                await ws.send_json({"type": "error", "reason": str(exc)})
                await ws.send_json({"type": "state", **session.status()})
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        pump.cancel()
        session.unsubscribe(queue)
