"""The cconnect MCP server an ACP agent reaches over HTTP: its tools and how to use the app."""

from __future__ import annotations

import asyncio
import hmac
import secrets
import sys
from typing import Any, Optional

from core import paths
from core.config import PORT
from mcps import build_cconnect_server
from mcps.shared_files import TOOL as SHARE_TOOL

PATH = "/api/mcp/agent"
NAME = "cconnect"
BRIDGE_SCRIPT = paths.SCRIPTS_DIR / "mcp_bridge.py"
URL_VARIABLE = "CCONNECT_MCP_URL"

_served: dict[str, "AgentMcp"] = {}


class AgentMcp:
    def __init__(self, context: dict, instructions: str):
        from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

        server = build_cconnect_server(context, only=[SHARE_TOOL])["instance"]
        server.instructions = instructions or None
        self.token = secrets.token_urlsafe(24)
        self._manager = StreamableHTTPSessionManager(app=server, stateless=True, json_response=True)
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{PORT}{PATH}/{self.token}"

    async def start(self) -> None:
        ready = asyncio.Event()
        self._task = asyncio.create_task(self._serve(ready))
        await ready.wait()
        _served[self.token] = self

    async def _serve(self, ready: asyncio.Event) -> None:
        async with self._manager.run():
            ready.set()
            await self._stop.wait()

    async def close(self) -> None:
        _served.pop(self.token, None)
        self._stop.set()
        if self._task is not None:
            await self._task

    def entry(self, http: bool) -> dict:
        if http:
            return {"type": "http", "name": NAME, "url": self.url, "headers": []}
        return {
            "name": NAME,
            "command": sys.executable,
            "args": [str(BRIDGE_SCRIPT)],
            "env": [{"name": URL_VARIABLE, "value": self.url}],
        }

    async def handle(self, scope: dict, receive: Any, send: Any) -> None:
        await self._manager.handle_request(scope, receive, send)


def _find(token: str) -> Optional[AgentMcp]:
    return next((served for key, served in _served.items() if token and hmac.compare_digest(key, token)), None)


async def asgi(scope: dict, receive: Any, send: Any) -> None:
    path = scope.get("path") or ""
    root = scope.get("root_path") or ""
    token = (path[len(root):] if root and path.startswith(root) else path).strip("/").split("/", 1)[0]
    served = _find(token) if scope.get("type") == "http" else None
    if served is None:
        await send({"type": "http.response.start", "status": 404, "headers": []})
        await send({"type": "http.response.body", "body": b""})
        return
    await served.handle({**scope, "path": "/", "raw_path": b"/"}, receive, send)
