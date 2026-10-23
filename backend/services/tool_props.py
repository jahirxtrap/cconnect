"""A tool site's props as the engine reads them, and a hook's rewrite of them turned back into the app's own."""

import json
from typing import Any

from services import claude_runtime, tool_calls

_ENGINE_FIELDS = ("tool", "input")
_AGENT_TOOLS = {"Agent", "Task"}
_AGENT_FIELDS = ("subagent_type", "description", "model", "effort")


def _engine_call(page: dict) -> dict:
    call = tool_calls.recall(page.get("tool_use_id")) or {}
    sent = dict(page)
    for key in _ENGINE_FIELDS:
        if key in page and key in call:
            sent[key] = call[key]
    if "output" in call and not page.get("isRunning"):
        sent["output"] = call["output"]
    if call.get("errored"):
        sent["isErrored"] = True
    return sent


def to_engine(component: str, page: dict) -> dict:
    if component == "ToolGroup":
        return {**page, "calls": [_engine_call(call) if isinstance(call, dict) else call for call in page.get("calls") or []]}
    if component in ("ToolUse", "ToolResult"):
        return _engine_call(page)
    return page


def _numbered(file: dict) -> str:
    start = file.get("startLine") if isinstance(file.get("startLine"), int) else 1
    lines = str(file.get("content") or "").split("\n")
    return "\n".join(f"{start + index}\t{line}" for index, line in enumerate(lines))


def _output_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return claude_runtime._flatten_result_content(value)
    if not isinstance(value, dict):
        return "" if value is None else str(value)
    if isinstance(value.get("file"), dict):
        return _numbered(value["file"])
    if "stdout" in value or "stderr" in value:
        return "\n".join(str(value[key]) for key in ("stdout", "stderr") if value.get(key))
    for key in ("content", "text", "result", "output"):
        if isinstance(value.get(key), str) and value[key]:
            return value[key]
    if isinstance(value.get("filenames"), list):
        return "\n".join(str(name) for name in value["filenames"])
    return json.dumps(value, ensure_ascii=False, indent=2)


def _input_view(tool: str, value: Any) -> dict:
    if tool in claude_runtime._FILE_EDIT_TOOLS and isinstance(value, dict):
        path = value.get("file_path") or value.get("notebook_path") or ""
        return {"path": path, "diff_lines": claude_runtime._build_file_diff(tool, value, path)}
    if tool in _AGENT_TOOLS and isinstance(value, dict):
        event = claude_runtime._agent_event(None, value)
        return {key: event[key] for key in _AGENT_FIELDS}
    return {"input": claude_runtime._format_tool_input(value)}


def _page_call(page: dict, sent: dict, drawn: dict) -> dict:
    view = dict(drawn)
    tool = drawn.get("tool") if isinstance(drawn.get("tool"), str) else str(sent.get("tool") or "")
    if "tool" in page:
        view["tool"] = page["tool"] if drawn.get("tool") == sent.get("tool") else claude_runtime._display_tool_name(tool)
    if "input" in page:
        view.pop("input", None)
        if drawn.get("input") == sent.get("input"):
            view["input"] = page["input"]
        else:
            view.update(_input_view(tool, drawn.get("input")))
    if "output" in page:
        view["output"] = page["output"] if drawn.get("output") == sent.get("output") else _output_text(drawn.get("output"))
    else:
        view.pop("output", None)
    return view


def to_page(component: str, page: dict, sent: dict, drawn: dict | None) -> dict | None:
    if drawn is None:
        return None
    if component == "ToolGroup":
        calls = [
            _page_call(own, given, rewritten) if isinstance(rewritten, dict) else rewritten
            for own, given, rewritten in zip(page.get("calls") or [], sent.get("calls") or [], drawn.get("calls") or [])
        ]
        return {**drawn, "calls": calls}
    if component in ("ToolUse", "ToolResult"):
        return _page_call(page, sent, drawn)
    return drawn
