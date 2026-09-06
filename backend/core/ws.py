"""WebSocket frames: orjson instead of the stdlib encoder Starlette's send_json uses."""

from typing import Any

import orjson
from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


async def send_event(ws: WebSocket, payload: Any) -> None:
    await ws.send_text(orjson.dumps(payload, default=jsonable_encoder).decode())
