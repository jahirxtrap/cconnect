"""WebSocket frames: orjson instead of the stdlib encoder Starlette's send_json uses."""

import asyncio
import json
from contextlib import suppress
from typing import Any, Callable, Optional, Protocol

import orjson
from fastapi import WebSocket, WebSocketDisconnect, status
from fastapi.encoders import jsonable_encoder
from loguru import logger
from pydantic import TypeAdapter, ValidationError

from middleware.public_auth import ws_bearer_ok

SEND_BACKLOG = 50_000


class WatchHub(Protocol):
    def subscribe(self) -> asyncio.Queue: ...

    def unsubscribe(self, queue: asyncio.Queue) -> None: ...


async def send_event(ws: WebSocket, payload: Any) -> None:
    await ws.send_text(orjson.dumps(payload, default=jsonable_encoder).decode())


class SocketWriter:
    """Sends in order without waiting on the network, and closes a socket a whole backlog behind."""

    def __init__(self, ws: WebSocket, contract: Optional[TypeAdapter] = None):
        self._ws = ws
        self._contract = contract
        self._queue: asyncio.Queue = asyncio.Queue(SEND_BACKLOG)
        self._pump = asyncio.create_task(self._drain())

    async def _drain(self) -> None:
        with suppress(Exception):
            while True:
                await send_event(self._ws, await self._queue.get())

    async def send(self, payload: Any) -> None:
        if self._pump.done():
            return
        if self._contract is not None:
            try:
                self._contract.validate_python(payload)
            except ValidationError as exc:
                logger.error(f"event outside the contract: {payload.get('type')}: {exc}")
        try:
            self._queue.put_nowait(payload)
        except asyncio.QueueFull:
            self._pump.cancel()
            with suppress(Exception):
                await self._ws.close(code=status.WS_1013_TRY_AGAIN_LATER)

    def close(self) -> None:
        self._pump.cancel()


async def refuse(ws: WebSocket) -> None:
    await ws.close(code=status.WS_1008_POLICY_VIOLATION)


async def accept_authorized(ws: WebSocket) -> bool:
    """Accept the socket when it carries the bearer, and reject its handshake otherwise."""
    if not ws_bearer_ok(ws):
        await refuse(ws)
        return False
    await ws.accept()
    return True


async def opening_message(ws: WebSocket) -> Optional[dict]:
    """The first message of an accepted socket, or None once the socket is closed."""
    if not await accept_authorized(ws):
        return None
    try:
        opening = await ws.receive_json()
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        return None
    if not isinstance(opening, dict):
        await refuse(ws)
        return None
    return opening


async def stream_watch(
    ws: WebSocket,
    hub: WatchHub,
    on_message: Optional[Callable[[asyncio.Queue, dict], None]] = None,
) -> None:
    if not await accept_authorized(ws):
        return
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
