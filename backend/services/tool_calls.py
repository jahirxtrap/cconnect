"""What each tool call carried, kept by its tool_use_id for the render props mods read."""

import asyncio
import json
from collections import OrderedDict
from typing import Any, Optional

_BUDGET = 64 * 1024 * 1024

_calls: "OrderedDict[str, dict]" = OrderedDict()
_sizes: dict[str, int] = {}
_total = 0
_claimed: set[str] = set()
_waiting: list[tuple[str, Any, asyncio.Future]] = []


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


async def claim(tool: str, wanted: Any, timeout: float) -> Optional[str]:
    for tool_use_id in reversed(_calls):
        call = _calls[tool_use_id]
        if tool_use_id not in _claimed and call.get("tool") == tool and call.get("input") == wanted:
            _claimed.add(tool_use_id)
            return tool_use_id
    entry = (tool, wanted, asyncio.get_running_loop().create_future())
    _waiting.append(entry)
    try:
        return await asyncio.wait_for(entry[2], timeout)
    except asyncio.TimeoutError:
        return None
    finally:
        if entry in _waiting:
            _waiting.remove(entry)


def remember(tool_use_id: Any, **fields: Any) -> None:
    global _total
    if not isinstance(tool_use_id, str) or not tool_use_id:
        return
    known = _calls.get(tool_use_id)
    given = {key: value for key, value in fields.items() if value is not None}
    if known is not None and all(known.get(key) == value for key, value in given.items()):
        _calls.move_to_end(tool_use_id)
        return
    call = {**(known or {}), **given}
    size = len(json.dumps(call, ensure_ascii=False, default=str))
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
    call = _calls.get(tool_use_id) if isinstance(tool_use_id, str) else None
    if call is not None:
        _calls.move_to_end(tool_use_id)
    return call


def remember_entries(entries: list[dict]) -> None:
    for entry in entries:
        content = (entry.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        if entry.get("type") == "assistant":
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    remember(block.get("id"), tool=block.get("name"), input=block.get("input"))
        elif entry.get("type") == "user":
            results = [block for block in content if isinstance(block, dict) and block.get("type") == "tool_result"]
            for block in results:
                remember(
                    block.get("tool_use_id"),
                    errored=bool(block.get("is_error")),
                    output=entry.get("toolUseResult") if len(results) == 1 else None,
                )
