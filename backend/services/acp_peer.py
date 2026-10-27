"""JSON-RPC 2.0 over the standard streams of an Agent Client Protocol process."""

import asyncio
import json
from typing import Any, Awaitable, Callable, Optional

STREAM_LIMIT = 64 * 1024 * 1024

AUTH_REQUIRED = -32000
RESOURCE_NOT_FOUND = -32002
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
REQUEST_CANCELLED = -32800

CANCEL_REQUEST = "$/cancel_request"

Handler = Callable[[str, dict], Awaitable[Any]]
Listener = Callable[[str, dict], Awaitable[None]]


class AcpError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
        super().__init__(message)
        self.code = code
        self.data = data


class AcpPeer:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, on_request: Handler, on_notification: Listener):
        self._reader = reader
        self._writer = writer
        self._on_request = on_request
        self._on_notification = on_notification
        self._pending: dict[int, asyncio.Future] = {}
        self._answering: dict[Any, asyncio.Task] = {}
        self._write_lock = asyncio.Lock()
        self._next_id = 0
        self.closed = False

    async def _write(self, message: dict) -> None:
        async with self._write_lock:
            self._writer.write((json.dumps({"jsonrpc": "2.0", **message}, ensure_ascii=False) + "\n").encode("utf-8"))
            await self._writer.drain()

    async def call(self, method: str, params: Optional[dict] = None) -> Any:
        if self.closed:
            raise AcpError(INTERNAL_ERROR, "the agent is not running")
        self._next_id += 1
        ident = self._next_id
        future = asyncio.get_running_loop().create_future()
        self._pending[ident] = future
        try:
            await self._write({"id": ident, "method": method, "params": params or {}})
            return await future
        except asyncio.CancelledError:
            if not self.closed:
                await self.notify(CANCEL_REQUEST, {"requestId": ident})
            raise
        finally:
            self._pending.pop(ident, None)

    async def notify(self, method: str, params: Optional[dict] = None) -> None:
        if not self.closed:
            await self._write({"method": method, "params": params or {}})

    async def serve(self) -> None:
        try:
            while line := await self._reader.readline():
                try:
                    message = json.loads(line)
                except ValueError:
                    continue
                if isinstance(message, dict):
                    await self._dispatch(message)
        finally:
            self.close()

    async def _dispatch(self, message: dict) -> None:
        method = message.get("method")
        if not isinstance(method, str):
            self._settle(message)
            return
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        if "id" not in message:
            if method == CANCEL_REQUEST:
                task = self._answering.get(params.get("requestId"))
                if task is not None:
                    task.cancel()
                return
            await self._on_notification(method, params)
            return
        ident = message["id"]
        task = asyncio.create_task(self._answer(ident, method, params))
        self._answering[ident] = task
        task.add_done_callback(lambda _done: self._answering.pop(ident, None))

    def _settle(self, message: dict) -> None:
        future = self._pending.get(message.get("id"))
        if future is None or future.done():
            return
        error = message.get("error")
        if isinstance(error, dict):
            future.set_exception(AcpError(int(error.get("code") or INTERNAL_ERROR), str(error.get("message") or ""), error.get("data")))
        else:
            future.set_result(message.get("result"))

    async def _answer(self, ident: Any, method: str, params: dict) -> None:
        try:
            reply = {"result": await self._on_request(method, params)}
        except asyncio.CancelledError:
            reply = {"error": {"code": REQUEST_CANCELLED, "message": "cancelled"}}
        except AcpError as exc:
            reply = {"error": {"code": exc.code, "message": str(exc), **({"data": exc.data} if exc.data is not None else {})}}
        except Exception as exc:
            reply = {"error": {"code": INTERNAL_ERROR, "message": f"{type(exc).__name__}: {exc}"}}
        if not self.closed:
            await self._write({"id": ident, **reply})

    def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        for task in list(self._answering.values()):
            task.cancel()
        for future in self._pending.values():
            if not future.done():
                future.set_exception(AcpError(INTERNAL_ERROR, "the agent stopped"))
