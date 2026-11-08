"""What each tool call carried, kept by its tool_use_id for the render props mods read."""

import asyncio
import threading
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Iterable, Optional

import orjson

_BUDGET = 64 * 1024 * 1024
_INLINE_LINE = 16 * 1024


@dataclass(frozen=True)
class OutputLine:
    path: str
    offset: int


_calls: "OrderedDict[str, dict]" = OrderedDict()
_sizes: dict[str, int] = {}
_total = 0
_claimed: set[str] = set()
_waiting: list[tuple[str, Any, asyncio.Future]] = []
_lock = threading.RLock()


def _settle(future: asyncio.Future, tool_use_id: str) -> None:
    if not future.done():
        future.set_result(tool_use_id)


def _hand_over(tool_use_id: str, call: dict) -> None:
    for waiter in list(_waiting):
        tool, wanted, future = waiter
        if tool_use_id in _claimed or future.done() or call.get("tool") != tool or call.get("input") != wanted:
            continue
        _claimed.add(tool_use_id)
        _waiting.remove(waiter)
        future.get_loop().call_soon_threadsafe(_settle, future, tool_use_id)
        return


def _claim_known(tool: str, wanted: Any) -> Optional[str]:
    with _lock:
        for tool_use_id in reversed(_calls):
            call = _calls[tool_use_id]
            if tool_use_id not in _claimed and call.get("tool") == tool and call.get("input") == wanted:
                _claimed.add(tool_use_id)
                return tool_use_id
    return None


async def claim(tool: str, wanted: Any, timeout: float) -> Optional[str]:
    known = _claim_known(tool, wanted)
    if known is not None:
        return known
    entry = (tool, wanted, asyncio.get_running_loop().create_future())
    with _lock:
        _waiting.append(entry)
    try:
        return await asyncio.wait_for(entry[2], timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        with _lock:
            if entry in _waiting:
                _waiting.remove(entry)


def remember(tool_use_id: Any, **fields: Any) -> None:
    global _total
    if not isinstance(tool_use_id, str) or not tool_use_id:
        return
    with _lock:
        known = _calls.get(tool_use_id)
        given = {key: value for key, value in fields.items() if value is not None}
        if known is not None and all(known.get(key) == value for key, value in given.items()):
            _calls.move_to_end(tool_use_id)
            return
        call = {**(known or {}), **given}
        size = len(orjson.dumps(call, default=str))
        _total += size - _sizes.get(tool_use_id, 0)
        _calls[tool_use_id] = call
        _sizes[tool_use_id] = size
        _calls.move_to_end(tool_use_id)
        while _total > _BUDGET and len(_calls) > 1:
            oldest, _ = _calls.popitem(last=False)
            _total -= _sizes.pop(oldest, 0)
            _claimed.discard(oldest)
        if _waiting:
            _hand_over(tool_use_id, call)


def recall(tool_use_id: Any) -> dict | None:
    if not isinstance(tool_use_id, str):
        return None
    with _lock:
        call = _calls.get(tool_use_id)
        if call is not None:
            _calls.move_to_end(tool_use_id)
        return call


def _read_output(tool_use_id: str, line: OutputLine) -> Any:
    try:
        with open(line.path, "rb") as fh:
            fh.seek(line.offset)
            entry = orjson.loads(fh.readline())
    except (OSError, orjson.JSONDecodeError):
        return None
    content = (entry.get("message") or {}).get("content") if isinstance(entry, dict) else None
    if not isinstance(content, list) or not any(isinstance(block, dict) and block.get("tool_use_id") == tool_use_id for block in content):
        return None
    return entry.get("toolUseResult")


def output_of(tool_use_id: str, call: dict) -> Any:
    output = call.get("output")
    return _read_output(tool_use_id, output) if isinstance(output, OutputLine) else output


def knows(tool_use_ids: list[str]) -> bool:
    with _lock:
        if not all(tool_use_id in _calls for tool_use_id in tool_use_ids):
            return False
        for tool_use_id in tool_use_ids:
            _calls.move_to_end(tool_use_id)
    return True


def _output(entry: dict, path: str, offset: int, size: int) -> Any:
    result = entry.get("toolUseResult")
    return result if result is None or size <= _INLINE_LINE else OutputLine(path, offset)


def remember_entries(path: str, lines: Iterable[tuple[int, int, dict]]) -> list[str]:
    remembered: list[str] = []
    for offset, size, entry in lines:
        content = (entry.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        if entry.get("type") == "assistant":
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    remember(block.get("id"), tool=block.get("name"), input=block.get("input"))
                    if isinstance(block.get("id"), str) and block["id"]:
                        remembered.append(block["id"])
        elif entry.get("type") == "user":
            results = [block for block in content if isinstance(block, dict) and block.get("type") == "tool_result"]
            for block in results:
                remember(
                    block.get("tool_use_id"),
                    errored=bool(block.get("is_error")),
                    output=_output(entry, path, offset, size) if len(results) == 1 else None,
                )
    return remembered
