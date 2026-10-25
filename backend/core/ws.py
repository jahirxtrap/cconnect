"""WebSocket frames: orjson instead of the stdlib encoder Starlette's send_json uses."""

import asyncio
from typing import Any, Callable, Optional

import orjson
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from loguru import logger

from middleware.public_auth import ws_bearer_ok
from services.directory_watch import DirectoryWatchHub


async def send_event(ws: WebSocket, payload: Any) -> None:
    await ws.send_text(orjson.dumps(payload, default=jsonable_encoder).decode())


async def stream_watch(
    ws: WebSocket,
    hub: DirectoryWatchHub,
    on_message: Optional[Callable[[asyncio.Queue, dict], None]] = None,
) -> None:
    if not ws_bearer_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    queue = hub.subscribe()

    async def pump():
        while True:
            await send_event(ws, await queue.get())

    pump_task = asyncio.create_task(pump())
    try:
        while True:
            message = await ws.receive_json()
            if on_message is not None:
                on_message(queue, message)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"watch socket ended: {type(exc).__name__}: {exc}")
    finally:
        pump_task.cancel()
        hub.unsubscribe(queue)
