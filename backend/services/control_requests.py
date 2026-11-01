import asyncio
import json
from typing import Any, AsyncIterator, Awaitable, Callable

from loguru import logger

Answer = Callable[[dict], Awaitable[dict]]
Answers = dict[str, Answer]

CONTROL_REQUEST = "control_request"
CONTROL_CANCEL = "control_cancel_request"


async def _respond(write: Callable[[str], Awaitable[None]], request_id: Any, answer: Answer, data: dict) -> None:
    try:
        response = {"subtype": "success", "request_id": request_id, "response": await answer(data)}
    except Exception as exc:
        logger.warning(f"{data.get('subtype')} unanswered: {type(exc).__name__}: {exc}")
        response = {"subtype": "error", "request_id": request_id, "error": str(exc)}
    await write(json.dumps({"type": "control_response", "response": response}) + "\n")


def serve(client: Any, answers: Answers) -> None:
    query = getattr(client, "_query", None)
    if query is None or not answers:
        return
    handle = query._handle_control_request

    async def handled(request: dict) -> None:
        data = request.get("request") or {}
        answer = answers.get(data.get("subtype"))
        if answer is None:
            await handle(request)
            return
        await _respond(query.transport.write, request.get("request_id"), answer, data)

    query._handle_control_request = handled


class Answering:
    def __init__(self, transport: Any, answers: Answers):
        self._transport = transport
        self._answers = answers
        self._pending: dict[Any, asyncio.Task] = {}

    def __getattr__(self, name: str) -> Any:
        return getattr(self._transport, name)

    async def read_messages(self) -> AsyncIterator[dict]:
        try:
            async for message in self._transport.read_messages():
                if not self._taken(message):
                    yield message
        finally:
            for task in list(self._pending.values()):
                task.cancel()

    def _taken(self, message: dict) -> bool:
        request_id = message.get("request_id")
        if message.get("type") == CONTROL_CANCEL and request_id in self._pending:
            self._pending.pop(request_id).cancel()
            return True
        data = message.get("request") or {}
        answer = self._answers.get(data.get("subtype")) if message.get("type") == CONTROL_REQUEST else None
        if answer is None:
            return False
        task = asyncio.create_task(_respond(self._transport.write, request_id, answer, data))
        self._pending[request_id] = task
        task.add_done_callback(lambda _: self._pending.pop(request_id, None))
        return True
