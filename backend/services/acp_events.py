"""How Agent Client Protocol traffic reads as the chat's own events, permission prompts and forms."""

import base64
import hashlib
import json
from typing import Any, Awaitable, Callable, Optional

from services import diffs
from services.claude_runtime import _format_tool_input

TOOL_NAMES = {
    "read": "Read",
    "edit": "Edit",
    "delete": "Delete",
    "move": "Move",
    "search": "Search",
    "execute": "Execute",
    "think": "Think",
    "fetch": "Fetch",
}
DEFERRED_KINDS = ("edit", "delete", "move")
FINISHED = ("completed", "failed")
COMPACTION_DONE = "completed"
COMPACTION_RUNNING = "in_progress"
PERMISSION_IDS = {"allow_once": "allow", "allow_always": "allow_always", "reject_once": "deny", "reject_always": "deny"}
ACCEPT = "accept"
DECLINE = "decline"
URL_MODE = "url"
URL_ACTION = "action"
INTEGER = "integer"
NUMBER = "number"
BOOLEAN = "boolean"
ARRAY = "array"

Share = Callable[[bytes, str, str], Awaitable[Optional[dict]]]
Watch = Callable[[str, str], None]


def tool_input(title: str, raw: Any) -> str:
    lines = [title, _format_tool_input(raw) if isinstance(raw, dict) and raw else json.dumps(raw) if raw else ""]
    return "\n".join(line for line in lines if line)


def _text_of(content: Any) -> str:
    if isinstance(content, dict) and content.get("type") == "text":
        return str(content.get("text") or "")
    return ""


def _output(record: dict) -> str:
    texts = [_text_of(item.get("content")) for item in record["content"] if item.get("type") == "content"]
    joined = "\n".join(text for text in texts if text)
    if joined:
        return joined
    raw = record.get("raw_output")
    return raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False) if raw else ""


class UpdateReader:
    def __init__(self, share: Share, watch: Watch):
        self._share = share
        self._watch = watch
        self.tools: dict[str, dict] = {}
        self._diffs: set[str] = set()
        self._summaries: dict[str, list[str]] = {}

    async def events(self, update: dict, replaying: bool) -> list[dict]:
        kind = update.get("sessionUpdate")
        if kind == "agent_message_chunk":
            return await self._content(update.get("content"))
        if kind == "agent_thought_chunk":
            text = _text_of(update.get("content"))
            return [{"type": "thinking", "text": text}] if text else []
        if kind == "user_message_chunk":
            text = _text_of(update.get("content"))
            return [{"type": "user_text", "text": text}] if replaying and text else []
        if kind in ("tool_call", "tool_call_update"):
            return self._tool(update)
        if kind == "plan":
            return [self._plan(update.get("entries") or [])]
        if kind == "compaction_update":
            return self._compaction(update)
        if kind == "compaction_summary_chunk":
            text = _text_of(update.get("content"))
            if text:
                self._summaries.setdefault(str(update.get("compactionId")), []).append(text)
            return []
        if kind == "notice":
            return [{
                "type": "notice",
                "name": str(update.get("title") or ""),
                "text": str(update.get("description") or ""),
                "level": str(update.get("severity") or "info"),
            }]
        return []

    async def _content(self, content: Any) -> list[dict]:
        if not isinstance(content, dict):
            return []
        kind = content.get("type")
        if kind == "text":
            return [{"type": "assistant_text", "text": str(content.get("text") or "")}]
        if kind == "resource_link":
            label = content.get("title") or content.get("name") or content.get("uri")
            return [{"type": "assistant_text", "text": f"[{label}]({content.get('uri')})"}]
        if kind == "resource":
            resource = content.get("resource") or {}
            if "text" in resource:
                return [{"type": "assistant_text", "text": f"\n```\n{resource['text']}\n```\n"}]
            return await self._media(resource.get("blob"), resource.get("mimeType") or "", resource.get("uri") or "")
        if kind in ("image", "audio"):
            return await self._media(content.get("data"), content.get("mimeType") or "", content.get("uri") or "")
        return []

    async def _media(self, data: Any, mime: str, uri: str) -> list[dict]:
        if not isinstance(data, str) or not data:
            return []
        try:
            raw = base64.b64decode(data, validate=True)
        except ValueError:
            return []
        shared = await self._share(raw, mime, uri)
        return [{"type": "shared", "files": [shared]}] if shared else []

    def _record(self, update: dict) -> dict:
        ident = str(update.get("toolCallId") or "")
        record = self.tools.setdefault(ident, {
            "id": ident,
            "kind": "other",
            "title": "",
            "status": "pending",
            "content": [],
            "raw_input": None,
            "raw_output": None,
            "shown": False,
            "file": False,
            "done": False,
            "terminals": set(),
        })
        for field, key in (("kind", "kind"), ("title", "title"), ("status", "status")):
            if update.get(key):
                record[field] = update[key]
        if isinstance(update.get("content"), list):
            record["content"] = [item for item in update["content"] if isinstance(item, dict)]
        if update.get("rawInput") is not None:
            record["raw_input"] = update["rawInput"]
        if update.get("rawOutput") is not None:
            record["raw_output"] = update["rawOutput"]
        return record

    def _tool(self, update: dict) -> list[dict]:
        record = self._record(update)
        events: list[dict] = []
        for index, item in enumerate(record["content"]):
            if item.get("type") == "diff":
                events.extend(self._diff(record, item, index))
            elif item.get("type") == "terminal" and item.get("terminalId") and item["terminalId"] not in record["terminals"]:
                record["terminals"].add(item["terminalId"])
                self._watch(record["id"], item["terminalId"])
        finished = record["status"] in FINISHED
        waiting = record["kind"] in DEFERRED_KINDS and not finished
        if not record["file"] and not record["shown"] and not waiting:
            record["shown"] = True
            events.append({
                "type": "tool_use",
                "id": record["id"],
                "name": TOOL_NAMES.get(record["kind"]),
                "mcp": False,
                "input": tool_input(record["title"], record["raw_input"]),
            })
        if finished and not record["done"]:
            record["done"] = True
            if not record["file"] and not record["terminals"]:
                events.append({"type": "tool_result", "tool_use_id": record["id"], "content": _output(record)})
        return events

    def _diff(self, record: dict, item: dict, index: int) -> list[dict]:
        path = str(item.get("path") or "")
        new = str(item.get("newText") or "")
        key = f"{path}\0{hashlib.sha256(new.encode('utf-8')).hexdigest()}"
        record["file"] = True
        if not path or key in self._diffs:
            return []
        self._diffs.add(key)
        return [self.file_change(record["id"] if index == 0 else f"{record['id']}-{index}", TOOL_NAMES.get(record["kind"]) or TOOL_NAMES["edit"], path, item.get("oldText") or "", new)]

    def file_change(self, ident: str, name: str, path: str, old: str, new: str) -> dict:
        return {"type": "file_change", "id": ident, "name": name, "path": path, "diff_lines": diffs.classify(diffs.unified(old, new, path))}

    def written(self, path: str, old: str, new: str) -> list[dict]:
        """A file the agent wrote through the client, shown unless a tool already showed that change."""
        key = f"{path}\0{hashlib.sha256(new.encode('utf-8')).hexdigest()}"
        if key in self._diffs or old == new:
            return []
        self._diffs.add(key)
        return [self.file_change(f"write-{hashlib.sha256(key.encode('utf-8')).hexdigest()[:16]}", TOOL_NAMES["edit"], path, old, new)]

    def _plan(self, entries: list) -> dict:
        items = [
            {"content": str(entry.get("content") or ""), "status": str(entry.get("status") or "pending"), "active_form": str(entry.get("content") or "")}
            for entry in entries
            if isinstance(entry, dict)
        ]
        return {"type": "todos", "items": items}

    def _compaction(self, update: dict) -> list[dict]:
        status = update.get("status")
        ident = str(update.get("compactionId"))
        if status == COMPACTION_RUNNING:
            return [{"type": "compacting"}]
        chunks = self._summaries.pop(ident, [])
        if status != COMPACTION_DONE:
            return [{"type": "compacting_ended"}]
        listed = update.get("summary")
        summary = "".join(_text_of(item) for item in listed) if isinstance(listed, list) else "".join(chunks)
        return [{"type": "compact", "trigger": "auto", "pre_tokens": None, "post_tokens": None, "summary": summary}]


def permission(params: dict, tools: dict[str, dict]) -> dict:
    call = params.get("toolCall") or {}
    record = tools.get(str(call.get("toolCallId") or "")) or {}
    kind = call.get("kind") or record.get("kind") or "other"
    title = call.get("title") or record.get("title") or ""
    raw = call.get("rawInput") if call.get("rawInput") is not None else record.get("raw_input")
    return {
        "kind": "permission",
        "tool_name": TOOL_NAMES.get(kind) or title,
        "tool_kind": kind,
        "tool_use_id": call.get("toolCallId"),
        "input": tool_input(title, raw),
        "options": [
            {"id": str(option.get("optionId")), "label": str(option.get("name") or ""), "kind": option.get("kind")}
            for option in params.get("options") or []
            if isinstance(option, dict) and option.get("optionId")
        ],
        "free_text": "off",
    }


def permission_outcome(answer: dict, params: dict) -> dict:
    chosen = answer.get("option_id")
    known = {str(option.get("optionId")) for option in params.get("options") or [] if isinstance(option, dict)}
    if chosen in known:
        return {"outcome": {"outcome": "selected", "optionId": chosen}}
    return {"outcome": {"outcome": "cancelled"}}


def resolved_id(option_id: Optional[str], options: list) -> Optional[str]:
    kind = next((option.get("kind") for option in options if isinstance(option, dict) and option.get("id") == option_id), None)
    return PERMISSION_IDS.get(kind or "", option_id)


def _field(name: str, spec: dict, required: bool) -> list[dict]:
    kind = spec.get("type")
    label = str(spec.get("title") or name)
    base: dict = {"id": name, "label": label, **({"required": True} if required else {})}
    about = [{"type": "text", "text": str(spec["description"])}] if spec.get("description") else []
    if kind == BOOLEAN:
        return [*about, {**base, "type": "toggle", "value": bool(spec.get("default"))}]
    if kind in (NUMBER, INTEGER):
        bounds = {key: spec[key] for key in ("minimum", "maximum") if isinstance(spec.get(key), (int, float))}
        return [*about, {
            **base,
            "type": "input",
            "format": "number",
            **({"min": bounds["minimum"]} if "minimum" in bounds else {}),
            **({"max": bounds["maximum"]} if "maximum" in bounds else {}),
            **({"step": 1} if kind == INTEGER else {}),
            **({"value": str(spec["default"])} if spec.get("default") is not None else {}),
        }]
    if kind == ARRAY:
        items = spec.get("items") or {}
        return [*about, {**base, "type": "select", "multiple": True, "options": _choices(items)}]
    choices = _choices(spec)
    if choices:
        return [*about, {**base, "type": "select", "display": "dropdown", "options": choices}]
    return [*about, {
        **base,
        "type": "input",
        **{key: spec[key] for key in ("pattern",) if isinstance(spec.get(key), str)},
        **({"min_length": spec["minLength"]} if isinstance(spec.get("minLength"), int) else {}),
        **({"max_length": spec["maxLength"]} if isinstance(spec.get("maxLength"), int) else {}),
        **({"value": str(spec["default"])} if spec.get("default") is not None else {}),
    }]


def _choices(spec: dict) -> list[dict]:
    listed = spec.get("oneOf") or spec.get("anyOf")
    if isinstance(listed, list):
        return [
            {"value": str(item.get("const")), "label": str(item.get("title") or item.get("const")), **({"description": str(item["description"])} if item.get("description") else {})}
            for item in listed
            if isinstance(item, dict) and item.get("const") is not None
        ]
    if isinstance(spec.get("enum"), list):
        return [{"value": str(value), "label": str(value)} for value in spec["enum"]]
    return []


def _typed(value: Any, spec: dict) -> Any:
    kind = spec.get("type")
    if kind == BOOLEAN:
        return value if isinstance(value, bool) else str(value).lower() == "true"
    if kind in (NUMBER, INTEGER):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return value
        return int(number) if kind == INTEGER or number.is_integer() else number
    if kind == ARRAY:
        return value if isinstance(value, list) else [value] if value else []
    return value


def elicitation(params: dict) -> dict:
    """The form the user answers for an agent's request."""
    message = str(params.get("message") or "")
    if params.get("mode") == URL_MODE:
        url = str(params.get("url") or "")
        return {
            "kind": "component",
            "title": message,
            "blocks": [
                {"type": "text", "text": f"[{url}]({url})"},
                {"type": "buttons", "id": URL_ACTION, "options": [
                    {"value": ACCEPT, "label": "", "label_key": "link_done", "style": "primary", "icon": "check"},
                    {"value": DECLINE, "label": "", "label_key": "cancel", "style": "plain", "icon": "x"},
                ]},
            ],
        }
    schema = params.get("requestedSchema") or {}
    required = set(schema.get("required") or [])
    blocks = [
        element
        for name, spec in (schema.get("properties") or {}).items()
        if isinstance(spec, dict)
        for element in _field(str(name), spec, name in required)
    ]
    return {"kind": "component", "title": message, "blocks": blocks}


def elicitation_answer(answer: dict, params: dict) -> dict:
    if answer.get("chat"):
        return {"action": DECLINE}
    values = answer.get("values") or {}
    if params.get("mode") == URL_MODE:
        return {"action": ACCEPT if values.get(URL_ACTION) == ACCEPT else DECLINE}
    properties = (params.get("requestedSchema") or {}).get("properties") or {}
    content = {name: _typed(values[name], spec) for name, spec in properties.items() if name in values and isinstance(spec, dict)}
    return {"action": ACCEPT, "content": content}
