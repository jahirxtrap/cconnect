"""Claude Code's hooks as chat rows: what a hook tells the user, a hook that fails or holds Claude
back, and the tool call a hook refused, read alike from the live stream and from the transcript."""

import json
import re
from typing import Any, Optional

WARNING = "warning"
_TOOL_GATE = "PreToolUse"
_TOOL_EVENTS = {"PreToolUse", "PostToolUse", "PostToolUseFailure"}
_HOOK_STARTED = "hook_started"
_CALL_MESSAGES = ("AssistantMessage", "UserMessage")
_REFUSED = re.compile(r"^(\w+):\S+ hook error: ")
_FEEDBACK = re.compile(r"^(\w+) hook feedback:\n")
_COMMAND_LEAD = re.compile(r"^\[[^\]\n]*\]: ")
_HELD_BACK = {
    "hook_non_blocking_error": "stderr",
    "hook_error_during_execution": "content",
    "hook_blocking_error": "blockingError",
    "hook_stopped_continuation": "message",
}
_FAILURES = frozenset({"hook_non_blocking_error", "hook_error_during_execution"})


def _row(event: Optional[str], name: Optional[str], text: Any, level: Optional[str] = None, raw: bool = False) -> Optional[dict]:
    body = str(text or "").strip()
    if not body:
        return None
    event = event or (name.split(":", 1)[0] if name else None)
    lead = f"{event}:"
    matcher = name[len(lead):] if name and event and name.startswith(lead) else None
    return {"type": "hook", "event": event, "matcher": matcher or None, "text": body, "level": level, "raw": raw}


def _output(stdout: Any) -> dict:
    text = str(stdout or "").strip()
    if not text.startswith("{"):
        return {}
    try:
        parsed = json.loads(text)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def from_response(data: dict) -> list[dict]:
    """A finished hook as the live stream reports it (``hook_response``)."""
    event = data.get("hook_event")
    name = data.get("hook_name")
    outcome = data.get("outcome")
    if outcome == "error":
        if data.get("exit_code") == 2 and event == _TOOL_GATE:
            return []
        rows = [_row(event, name, data.get("stderr") or data.get("output"), WARNING, raw=True)]
    elif outcome == "success":
        output = _output(data.get("stdout"))
        rows = [_row(event, name, output.get("systemMessage"))]
        if output.get("decision") == "block" and event != _TOOL_GATE:
            rows.append(_row(event, name, output.get("reason"), WARNING))
        if output.get("continue") is False:
            rows.append(_row(event, name, output.get("stopReason"), WARNING))
    else:
        rows = []
    return [row for row in rows if row]


def from_attachment(attachment: dict) -> Optional[dict]:
    """A hook the CLI kept in the transcript as an attachment."""
    kind = attachment.get("type")
    event = attachment.get("hookEvent")
    name = attachment.get("hookName")
    if kind == "hook_system_message":
        return _row(event, name, attachment.get("content"))
    if kind not in _HELD_BACK or event == _TOOL_GATE:
        return None
    value = attachment.get(_HELD_BACK[kind])
    if isinstance(value, dict):
        value = value.get("blockingError")
    return _row(event, name, _COMMAND_LEAD.sub("", str(value or "")), WARNING, raw=kind in _FAILURES)


def from_feedback(text: str) -> Optional[dict]:
    """The feedback a blocking hook hands back to Claude, kept as a meta user message."""
    match = _FEEDBACK.match(text)
    return _row(match.group(1), None, _COMMAND_LEAD.sub("", text[match.end():]), WARNING) if match else None


def refused_by(text: str) -> Optional[str]:
    """The hook event that refused a tool call, read from the call's error result."""
    match = _REFUSED.match(text)
    return match.group(1) if match else None


def reason(text: str) -> str:
    """A tool result without the lead the CLI puts before a hook's refusal."""
    return _REFUSED.sub("", text, count=1)


def shown(row: Optional[dict], mode: str) -> Optional[dict]:
    if row is None or mode == "off":
        return None
    return {**row, "text": ""} if mode == "label" else row


class HookOwners:
    """The agent a tool hook ran for: the oldest unanswered call of the tool its live event names."""

    def __init__(self):
        self._calls: dict[str, tuple[str, Optional[str], set[str]]] = {}
        self._hooks: dict[str, Optional[str]] = {}
        self._group: Optional[tuple[str, str, Optional[str]]] = None

    def observe(self, message: Any) -> None:
        """Follow one streamed message: a tool call, its answer, or a hook that starts."""
        kind = type(message).__name__
        data = getattr(message, "data", None)
        if isinstance(data, dict) and data.get("subtype") == _HOOK_STARTED:
            self._started(data)
            return
        self._group = None
        blocks = getattr(message, "content", None) if kind in _CALL_MESSAGES else None
        parent = getattr(message, "parent_tool_use_id", None)
        for block in blocks if isinstance(blocks, list) else []:
            block_kind = type(block).__name__
            if block_kind == "ToolUseBlock" and getattr(block, "id", None):
                self._calls[block.id] = (getattr(block, "name", "") or "", parent, set())
            elif block_kind == "ToolResultBlock":
                self._calls.pop(getattr(block, "tool_use_id", None) or "", None)

    def _started(self, data: dict) -> None:
        event = data.get("hook_event")
        name = str(data.get("hook_name") or "")
        hook_id = data.get("hook_id")
        if event not in _TOOL_EVENTS or not hook_id or ":" not in name:
            return
        tool = name.split(":", 1)[1]
        if self._group is None or self._group[:2] != (event, tool):
            claimed = next(
                (call for call in self._calls.values() if call[0] == tool and event not in call[2]),
                None,
            )
            if claimed is None:
                return
            claimed[2].add(event)
            self._group = (event, tool, claimed[1])
        self._hooks[hook_id] = self._group[2]

    def owner(self, data: Any) -> Optional[str]:
        """The agent call a finished hook belongs to, or None for the main conversation."""
        return self._hooks.pop(data.get("hook_id"), None) if isinstance(data, dict) else None
