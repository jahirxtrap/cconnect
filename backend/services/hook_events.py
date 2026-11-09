"""Claude Code's hooks as chat rows: what a hook tells the user, a hook that fails or holds Claude
back, and the tool call a hook refused, read alike from the live stream and from the transcript."""

import json
import re
from typing import Any, Optional

WARNING = "warning"
_TOOL_GATE = "PreToolUse"
_REFUSED = re.compile(r"^(\w+):\S+ hook error: ")
_FEEDBACK = re.compile(r"^(\w+) hook feedback:\n")
_COMMAND_LEAD = re.compile(r"^\[[^\]\n]*\]: ")
_HELD_BACK = {
    "hook_non_blocking_error": "stderr",
    "hook_error_during_execution": "content",
    "hook_blocking_error": "blockingError",
    "hook_stopped_continuation": "message",
}


def _row(event: Optional[str], name: Optional[str], text: Any, level: Optional[str] = None) -> Optional[dict]:
    body = str(text or "").strip()
    if not body:
        return None
    event = event or (name.split(":", 1)[0] if name else None)
    lead = f"{event}:"
    matcher = name[len(lead):] if name and event and name.startswith(lead) else None
    return {"type": "hook", "event": event, "matcher": matcher or None, "text": body, "level": level}


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
        rows = [_row(event, name, data.get("stderr") or data.get("output"), WARNING)]
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
    return _row(event, name, _COMMAND_LEAD.sub("", str(value or "")), WARNING)


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
