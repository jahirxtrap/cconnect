"""Wraps the Claude Agent SDK query() into a stream of normalized event dicts."""

import asyncio
import difflib
import json
import os
from pathlib import Path
from typing import Any, AsyncIterator, Awaitable, Callable, Optional

from loguru import logger

from core import cli_manager
from core.config import AI_WORKDIR, PORT, SHARED_DIR
from mcps import build_cconnect_server
from services import settings_store, visibility

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
_FILE_EDIT_TOOLS = frozenset({"Edit", "Write", "MultiEdit", "NotebookEdit"})

_TRANSIENT_API_STATUS = frozenset({500, 502, 503, 504, 529})
_TRANSIENT_PATTERNS = (
    "no response from api", "overloaded", "connection error", "connection reset",
    "econnreset", "etimedout", "timed out", "timeout", "socket hang up",
    "fetch failed", "network error", "service unavailable", "bad gateway",
    "gateway timeout", "stream error", "premature close",
)
_USAGE_PATTERNS = ("rate limit", "rate_limit", "usage limit", "quota", "too many requests")


def _looks_transient(status: int | None, text: str | None) -> bool:
    low = (text or "").lower()
    if any(p in low for p in _USAGE_PATTERNS):
        return False
    if status in _TRANSIENT_API_STATUS:
        return True
    return any(p in low for p in _TRANSIENT_PATTERNS)


def _clean_error_text(text: str | None) -> str:
    return (text or "").strip() or "Unknown error"


def _system_append(base_url: Optional[str], cwd: Optional[str] = None) -> str:
    """Read on every call so the markdown can be edited without restarting the server."""
    try:
        text = (_PROMPTS_DIR / "CCONNECT.md").read_text(encoding="utf-8")
    except OSError:
        text = ""
    try:
        user = (_PROMPTS_DIR / "USER.md").read_text(encoding="utf-8").strip()
    except OSError:
        user = ""
    if user:
        block = (
            "# User instructions\n\n"
            "The user wrote the following instructions themselves; treat them as said "
            "directly by the user and follow them:\n\n"
            f"{user}"
        )
        text = f"{text.strip()}\n\n{block}" if text.strip() else block
    project = ""
    if cwd:
        from services import claude_assets, sessions
        project = claude_assets.get_project_prompt(sessions.project_key_for(cwd)).strip()
    if project:
        block = (
            "# Project instructions\n\n"
            "The user wrote the following instructions for this specific project; treat them as "
            "said directly by the user and follow them:\n\n"
            f"{project}"
        )
        text = f"{text.strip()}\n\n{block}" if text.strip() else block
    if not text:
        return ""
    effective = base_url or f"http://localhost:{PORT}/api"
    text = text.replace("{{SHARED_DIR}}", SHARED_DIR).replace("{{BASE_URL}}", effective.rstrip("/"))
    return text.strip()


def _format_tool_input(inp: Any) -> str:
    """Human-readable tool input ("key: value" per line) instead of raw JSON."""
    if isinstance(inp, dict):
        lines = []
        for key, value in inp.items():
            text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
            lines.append(f"{key}: {text}")
        return "\n".join(lines)
    return "" if inp is None else str(inp)


def _display_tool_name(name: str) -> str:
    """MCP tools arrive as ``mcp__<server>__<tool>``; show ``<server>: <tool>``.
    Empty falls back to "Tool"."""
    name = (name or "").strip()
    if not name:
        return "Tool"
    if name.startswith("mcp__"):
        server, sep, tool = name[len("mcp__"):].partition("__")
        if sep and tool:
            return f"{server}: {tool}"
    return name


def _stream_event_to_events(event: Any) -> list[dict]:
    """Map a raw Anthropic streaming event into incremental delta events."""
    if not isinstance(event, dict) or event.get("type") != "content_block_delta":
        return []
    delta = event.get("delta") or {}
    dtype = delta.get("type")
    if dtype == "text_delta":
        return [{"type": "assistant_text", "text": delta.get("text", "")}]
    if dtype == "thinking_delta":
        return [{"type": "thinking", "text": delta.get("thinking", "")}]
    return []


def _task_events_from_result(result: Any) -> list[dict]:
    """Task* tools return their task(s) in tool_use_result, not in the tool block."""
    if not isinstance(result, dict):
        return []
    if isinstance(result.get("task"), dict):
        tasks = [result["task"]]
    elif isinstance(result.get("tasks"), list):
        tasks = [t for t in result["tasks"] if isinstance(t, dict)]
    else:
        return []
    return [
        {"type": "task", "id": str(t.get("id") or ""), "content": t.get("subject"), "status": t.get("status")}
        for t in tasks
        if t.get("id")
    ]


def _todo_items(todos: Any) -> list[dict]:
    if not isinstance(todos, list):
        return []
    return [
        {
            "content": t.get("content", ""),
            "status": t.get("status", "pending"),
            "active_form": t.get("activeForm", ""),
        }
        for t in todos
        if isinstance(t, dict)
    ]


def _flatten_result_content(content: Any) -> str:
    """Tool results can be a string, a list of {type:'text', text:...} blocks, or raw text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for r in content:
            if isinstance(r, dict) and r.get("type") == "text":
                parts.append(r.get("text", ""))
            elif isinstance(r, str):
                parts.append(r)
        return "\n".join(p for p in parts if p)
    return "" if content is None else str(content)


def _unified_diff(old: str, new: str, path: str) -> list[str]:
    return list(
        difflib.unified_diff(
            (old or "").splitlines(),
            (new or "").splitlines(),
            fromfile=path,
            tofile=path,
            lineterm="",
        )
    )


# +/- is stripped from text because kind already encodes it.
def _classify_diff_lines(lines: list[str]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    last_header: str | None = None
    i = 0
    while i < len(lines):
        line = lines[i]
        following = lines[i + 1] if i + 1 < len(lines) else ""
        if line.startswith("---") and following.startswith("+++"):
            old_path = line[3:].strip()
            new_path = following[3:].strip()
            for text in ((new_path,) if old_path == new_path else (old_path, new_path)):
                if text != last_header:
                    out.append({"kind": "header", "text": text})
                    last_header = text
            i += 2
            continue
        if line.startswith("@@"):
            out.append({"kind": "hunk", "text": line})
        elif line.startswith("+"):
            out.append({"kind": "add", "text": line[1:]})
        elif line.startswith("-"):
            out.append({"kind": "del", "text": line[1:]})
        else:
            out.append({"kind": "ctx", "text": line[1:] if line.startswith(" ") else line})
        i += 1
    return out


def _build_file_diff(name: str, raw_input: dict, path: str) -> list[dict[str, str]]:
    if name == "Edit":
        return _classify_diff_lines(
            _unified_diff(raw_input.get("old_string") or "", raw_input.get("new_string") or "", path)
        )
    if name == "MultiEdit":
        merged: list[str] = []
        for edit in raw_input.get("edits") or []:
            if not isinstance(edit, dict):
                continue
            chunk = _unified_diff(edit.get("old_string") or "", edit.get("new_string") or "", path)
            if chunk:
                merged.extend(chunk)
        return _classify_diff_lines(merged)
    if name == "Write":
        return _classify_diff_lines(_unified_diff("", raw_input.get("content") or "", path))
    if name == "NotebookEdit":
        return _classify_diff_lines(_unified_diff("", raw_input.get("new_source") or "", path))
    return []


def _file_change_event(block: Any, raw_input: Any, hidden: set[str]) -> dict | None:
    if not isinstance(raw_input, dict):
        return None
    path = raw_input.get("file_path") or raw_input.get("notebook_path")
    if not isinstance(path, str) or not path:
        return None
    name = (getattr(block, "name", None) or "").strip()
    diff_lines = _build_file_diff(name, raw_input, path)
    bid = getattr(block, "id", None)
    if bid:
        hidden.add(bid)
    return {"type": "file_change", "id": bid, "path": path, "diff_lines": diff_lines}


def _blocks_to_events(content: Any, vis: dict, skip_streamed: bool = False, hidden_tool_ids: set[str] | None = None) -> list[dict]:
    """Convert message blocks to events. When ``skip_streamed`` is set,
    text and thinking are omitted because they already arrived as deltas.
    ``hidden_tool_ids`` collects tool_use ids that should be suppressed
    (used to hide AskUserQuestion's tool_use AND its matching tool_result).
    ``vis`` is the most detail any attached socket asked for."""
    events: list[dict] = []
    hidden = hidden_tool_ids if hidden_tool_ids is not None else set()
    for block in content or []:
        kind = type(block).__name__
        if kind == "TextBlock":
            if skip_streamed:
                continue
            events.append({"type": "assistant_text", "text": getattr(block, "text", "").strip()})
        elif kind == "ThinkingBlock":
            mode = vis["thinking"]
            if mode == "off":
                continue
            if mode == "label":
                events.append({"type": "thinking", "label": True})
                continue
            if skip_streamed:
                continue
            events.append({"type": "thinking", "text": (getattr(block, "thinking", "") or getattr(block, "text", "")).strip()})
        elif kind == "ToolUseBlock":
            name = (getattr(block, "name", None) or "").strip()
            raw_input = getattr(block, "input", None)
            if name == "AskUserQuestion":
                # Surfaced as an interaction block; don't render the tool_use itself.
                bid = getattr(block, "id", None)
                if bid:
                    hidden.add(bid)
                continue
            if name == "ExitPlanMode":
                bid = getattr(block, "id", None)
                if bid:
                    hidden.add(bid)
                continue
            if name in ("Agent", "Task") and isinstance(raw_input, dict):
                mode = vis["tool_use"]
                if mode != "off":
                    events.append({
                        "type": "agent",
                        "id": getattr(block, "id", None),
                        "subagent_type": raw_input.get("subagent_type"),
                        "description": raw_input.get("description"),
                        "label": mode == "label",
                    })
                continue
            if name == "TodoWrite" and isinstance(raw_input, dict):
                events.append({"type": "todos", "items": _todo_items(raw_input.get("todos"))})
            elif name == "TaskUpdate" and isinstance(raw_input, dict):
                events.append({
                    "type": "task",
                    "id": str(raw_input.get("taskId") or ""),
                    "content": raw_input.get("subject"),
                    "status": raw_input.get("status"),
                })
            elif name in _FILE_EDIT_TOOLS:
                event = _file_change_event(block, raw_input, hidden)  # also marks the edit's result hidden
                mode = vis["file_change"]
                if event is not None and mode != "off":
                    if mode == "label":
                        event = {"type": "file_change", "id": event.get("id"), "path": event.get("path"), "label": True}
                    events.append(event)
            elif not name.startswith("Task"):
                if vis["tool_use"] == "off":
                    continue
                events.append({
                    "type": "tool_use",
                    "id": getattr(block, "id", None),
                    "name": _display_tool_name(name),
                    "input": _format_tool_input(raw_input),
                })
        elif kind == "ToolResultBlock":
            tuid = getattr(block, "tool_use_id", None)
            if tuid and tuid in hidden:
                continue
            mode = vis["tool_use"]
            if mode == "off":
                continue
            ev = {"type": "tool_result", "tool_use_id": tuid}
            if mode == "full":
                ev["content"] = _flatten_result_content(getattr(block, "content", None)).strip()
            events.append(ev)
    return events


def _build_can_use_tool(ask_user: Callable[[dict], Awaitable[dict]]):
    """can_use_tool callback routing AskUserQuestion + permission prompts through ``ask_user``.
    Shared by the main chat and the quick chat, so every interaction type works in both."""
    from claude_agent_sdk import PermissionResultAllow, PermissionResultDeny

    async def _can_use_tool(tool_name: str, tool_input: dict, ctx) -> Any:
        if tool_name == "AskUserQuestion" and isinstance(tool_input, dict):
            qs = [q for q in (tool_input.get("questions") or []) if isinstance(q, dict)]
            payload_questions = [
                {
                    "header": q.get("header"),
                    "question": q.get("question"),
                    "multi_select": bool(q.get("multiSelect")),
                    "options": [
                        {
                            "id": f"{qi}_{oi}",
                            "label": str(opt.get("label", "")),
                            "description": opt.get("description"),
                            "preview": opt.get("preview"),
                        }
                        for oi, opt in enumerate(q.get("options", []))
                        if isinstance(opt, dict)
                    ],
                }
                for qi, q in enumerate(qs)
            ]
            response = await ask_user({"kind": "questions", "questions": payload_questions})
            if response.get("chat"):
                return PermissionResultDeny(
                    message="The user declined the questions and wants to discuss this instead. Ask them how they'd like to proceed."
                )
            raw_answers = response.get("answers") or []
            answers: dict[str, Any] = {}
            annotations: dict[str, Any] = {}
            for qi, q in enumerate(qs):
                ans = raw_answers[qi] if qi < len(raw_answers) and isinstance(raw_answers[qi], dict) else {}
                opts = payload_questions[qi]["options"]
                selected = ans.get("selected") or []
                labels = [o["label"] for o in opts if o["id"] in selected]
                free_text = (ans.get("free_text") or "").strip()
                if free_text:
                    labels.append(free_text)
                notes = (ans.get("notes") or "").strip()
                if not labels and not notes:
                    continue
                qkey = str(q.get("question", ""))
                answers[qkey] = labels if q.get("multiSelect") else (labels[0] if labels else "")
                if notes:
                    annotations[qkey] = {"notes": notes}
            updated: dict[str, Any] = {"questions": qs, "answers": answers}
            if annotations:
                updated["annotations"] = annotations
            return PermissionResultAllow(updated_input=updated)

        if tool_name == "ExitPlanMode" and isinstance(tool_input, dict):
            tool_display = (tool_input.get("plan") or "").strip()
        else:
            tool_display = _format_tool_input(tool_input)
        response = await ask_user({
            "kind": "permission",
            "tool_name": tool_name,
            "tool_use_id": getattr(ctx, "tool_use_id", None),
            "input": tool_display,
            "options": (
                [{"id": "allow"}, {"id": "deny"}, {"id": "different"}]
                if tool_name == "ExitPlanMode"
                else [
                    {"id": "allow"},
                    {"id": "allow_always"},
                    {"id": "deny"},
                    {"id": "different"},
                ]
            ),
            "free_text": "off",
        })
        option = response.get("option_id")
        if option == "allow_always":
            persist = [
                s for s in (getattr(ctx, "suggestions", []) or [])
                if getattr(s, "destination", None) == "localSettings"
            ]
            return PermissionResultAllow(updated_input=tool_input, updated_permissions=persist)
        if option == "allow":
            return PermissionResultAllow(updated_input=tool_input)
        if option == "different":
            return PermissionResultDeny(
                message="User declined this action and wants to redirect. Ask them how they'd like you to proceed instead."
            )
        return PermissionResultDeny(message="User declined")

    return _can_use_tool


# A no-op PreToolUse hook keeps the prompt stream open while can_use_tool awaits the user.
async def _keep_stream_open(input_data, tool_use_id, context):
    return {"continue_": True}


async def run_prompt(
    prompt: str,
    cwd: str,
    images: Optional[list[dict]] = None,
    permission_mode: str = "default",
    resume: Optional[str] = None,
    resume_at: Optional[str] = None,
    fork: bool = False,
    model: Optional[str] = None,
    account: Optional[str] = None,
    effort: str = "max",
    partial: bool = False,
    name: Optional[str] = None,
    ask_user: Optional[Callable[[dict], Awaitable[dict]]] = None,
    base_url: Optional[str] = None,
    emit: Optional[Callable[[dict], Awaitable[None]]] = None,
    drain: Optional[AsyncIterator[dict]] = None,
    seed_id: Optional[str] = None,
    wanted: Optional[Callable[[], dict]] = None,
) -> AsyncIterator[dict]:
    from claude_agent_sdk import (
        query,
        ClaudeAgentOptions,
        AssistantMessage,
        SystemMessage,
        ResultMessage,
        StreamEvent,
        UserMessage,
        PermissionResultAllow,
        PermissionResultDeny,
        HookMatcher,
    )

    vis = wanted or visibility.defaults
    ultracode = effort == "ultracode"
    effort_level = "xhigh" if ultracode else (None if effort in (None, "", "default") else effort)
    extra_args = {"name": name} if name else {}
    if resume and resume_at:
        extra_args["resume-session-at"] = resume_at
    if drain is not None:
        extra_args["replay-user-messages"] = None

    system_prompt: dict = {"type": "preset", "preset": "claude_code"}
    append = _system_append(base_url, cwd)
    if append:
        system_prompt["append"] = append

    options_kwargs: dict[str, Any] = dict(
        cwd=cwd,
        permission_mode=permission_mode,
        resume=resume,
        fork_session=fork,
        model=model,
        effort=effort_level,
        system_prompt=system_prompt,
        setting_sources=["user", "project"],
        thinking={"type": "adaptive", "display": "summarized"},
        include_partial_messages=partial,
        extra_args=extra_args,
        mcp_servers={"cconnect": build_cconnect_server()},
        cli_path=cli_manager.resolve_cli_path(),
        enable_file_checkpointing=True,
    )
    from services import accounts
    session_env = dict(accounts.env_for(account))
    if settings_store.get("todo_tools"):
        session_env["CLAUDE_CODE_ENABLE_TODO_TOOLS"] = "1"
    if session_env:
        options_kwargs["env"] = session_env
    if ultracode:
        options_kwargs["settings"] = json.dumps({"ultracode": True})
    status_state = {"slow": False, "last": 0.0, "compacting": False, "awaiting_user": False, "pending": set()}
    hooks_map: dict[str, Any] = {}
    loop = asyncio.get_running_loop() if emit is not None else None
    if ask_user is not None:
        base_can_use_tool = _build_can_use_tool(ask_user)
        if emit is not None:
            async def _can_use_tool_status(tool_name, tool_input, ctx):
                status_state["awaiting_user"] = True
                if status_state["slow"]:
                    status_state["slow"] = False
                    try:
                        await emit({"type": "status", "kind": "ok"})
                    except Exception:
                        pass
                try:
                    return await base_can_use_tool(tool_name, tool_input, ctx)
                finally:
                    status_state["awaiting_user"] = False
                    status_state["last"] = loop.time()
            options_kwargs["can_use_tool"] = _can_use_tool_status
        else:
            options_kwargs["can_use_tool"] = base_can_use_tool
        hooks_map["PreToolUse"] = [HookMatcher(matcher=None, hooks=[_keep_stream_open])]
    if emit is not None:
        async def _pre_compact(input_data, tool_use_id, context):
            status_state["compacting"] = True
            if status_state["slow"]:
                status_state["slow"] = False
                try:
                    await emit({"type": "status", "kind": "ok"})
                except Exception:
                    pass
            await emit({"type": "compacting", "trigger": (input_data or {}).get("trigger")})
            return {}
        hooks_map["PreCompact"] = [HookMatcher(matcher=None, hooks=[_pre_compact])]

        async def _idle_watchdog():
            while True:
                await asyncio.sleep(4)
                if (
                    not status_state["slow"]
                    and not status_state["compacting"]
                    and not status_state["awaiting_user"]
                    and not status_state["pending"]
                    and loop.time() - status_state["last"] > 15
                ):
                    status_state["slow"] = True
                    try:
                        await emit({"type": "status", "kind": "slow"})
                    except Exception:
                        pass
    if hooks_map:
        options_kwargs["hooks"] = hooks_map
    options = ClaudeAgentOptions(**options_kwargs)

    content = [{"type": "text", "text": prompt}, *images] if images else prompt

    chips: list[dict] = [{"id": seed_id, "sent": prompt, "drained": False}]
    seen_users: set[str] = set()
    if drain is not None and resume and cwd:
        try:
            from services import sessions as _seed
            for _u in _seed.tail_user_messages(_seed.project_key_for(cwd), resume):
                seen_users.add(_u["uuid"])
        except Exception:
            pass

    def _flush_users(sid: str | None) -> list[dict]:
        if drain is None or not sid or not cwd:
            return []
        try:
            from services import sessions as _q
            users = _q.tail_user_messages(_q.project_key_for(cwd), sid)
        except Exception:
            return []
        events: list[dict] = []
        for u in users:
            uid = u["uuid"]
            if uid in seen_users:
                continue
            text = u["text"]
            notif = _q._notification_item(text)
            if notif is not None:
                seen_users.add(uid)
                events.append(notif)
                continue
            if not chips:
                continue
            seen_users.add(uid)
            matched = None
            acc = ""
            for i, c in enumerate(chips):
                acc = c["sent"] if i == 0 else acc + "\n" + c["sent"]
                if acc == text:
                    matched = i + 1
                    break
                if len(acc) >= len(text):
                    break
            k = matched if matched is not None else 1
            taken, chips[:k] = chips[:k], []
            events.append({
                "type": "dequeued",
                "ids": [c["id"] for c in taken if c["id"]],
                "text": text,
                "consumed": sum(1 for c in taken if c["drained"]),
            })
        return events

    async def _prompt_stream():
        yield {"type": "user", "message": {"role": "user", "content": content}}
        if drain is not None:
            from services import attachments as attachments_service
            async for item in drain:
                atts = item.get("attachments")
                if atts:
                    itext, iimages = attachments_service.compose_prompt(item["text"], atts)
                    icontent = [{"type": "text", "text": itext}, *iimages] if iimages else itext
                    sent = itext
                else:
                    icontent = item["text"]
                    sent = item["text"]
                chips.append({"id": item.get("id"), "sent": sent, "drained": True})
                yield {"type": "user", "message": {"role": "user", "content": icontent}}
    prompt_arg = _prompt_stream() if (ask_user is not None or images or drain is not None) else prompt

    hidden_tool_ids: set[str] = set()
    first_chunk_pending: set[int] = set()

    watchdog_task = None
    try:
        current_sid: str | None = None
        if emit is not None:
            status_state["last"] = loop.time()
            watchdog_task = asyncio.create_task(_idle_watchdog())
        async for message in query(prompt=prompt_arg, options=options):
            if emit is not None:
                status_state["last"] = loop.time()
                status_state["compacting"] = False
                if status_state["slow"]:
                    status_state["slow"] = False
                    await emit({"type": "status", "kind": "ok"})
            _msid = getattr(message, "session_id", None)
            if isinstance(_msid, str):
                if _msid != current_sid:
                    yield {"type": "session_started", "session_id": _msid}
                current_sid = _msid
            parent = getattr(message, "parent_tool_use_id", None)
            agent_mode = vis()["tool_use"] if parent else None
            if parent and agent_mode == "off":
                continue
            if isinstance(message, StreamEvent):
                raw = message.event
                idx = raw.get("index") if isinstance(raw, dict) else None
                if isinstance(raw, dict) and raw.get("type") == "content_block_start":
                    if isinstance(idx, int):
                        first_chunk_pending.add(idx)
                    if not parent:
                        for ev in _flush_users(current_sid):
                            yield ev
                stream_thinking = vis()["thinking"] == "full"
                for event in _stream_event_to_events(raw):
                    if event.get("type") == "thinking" and not stream_thinking:
                        continue
                    if isinstance(idx, int) and idx in first_chunk_pending and event.get("text"):
                        event["text"] = event["text"].lstrip()
                        first_chunk_pending.discard(idx)
                    if parent:
                        event["parent"] = parent
                    yield event
            elif isinstance(message, AssistantMessage):
                if not parent:
                    for ev in _flush_users(current_sid):
                        yield ev
                _err = getattr(message, "error", None)
                if _err and not parent:
                    _text = "".join(
                        getattr(b, "text", "") for b in (message.content or [])
                        if type(b).__name__ == "TextBlock"
                    ).strip() or f"API Error: {_err}"
                    yield {"type": "api_error", "text": _text}
                else:
                    if emit is not None:
                        for _b in message.content or []:
                            if type(_b).__name__ == "ToolUseBlock":
                                _bid = getattr(_b, "id", None)
                                if _bid:
                                    status_state["pending"].add(_bid)
                    for event in _blocks_to_events(message.content, vis(), skip_streamed=partial, hidden_tool_ids=hidden_tool_ids):
                        if parent:
                            event["parent"] = parent
                        yield event
                    if not parent and current_sid and cwd:
                        try:
                            from services import sessions as _sessions
                            cctx = _sessions.last_context_tokens(_sessions.project_key_for(cwd), current_sid)
                        except Exception:
                            cctx = None
                        if cctx:
                            yield {"type": "context", "context_tokens": cctx}
            elif isinstance(message, UserMessage):
                if emit is not None:
                    for _b in getattr(message, "content", None) or []:
                        if type(_b).__name__ == "ToolResultBlock":
                            status_state["pending"].discard(getattr(_b, "tool_use_id", None))
                tu_mode = vis()["tool_use"]
                if tu_mode != "off":
                    for block in getattr(message, "content", None) or []:
                        if type(block).__name__ != "ToolResultBlock":
                            continue
                        tuid = getattr(block, "tool_use_id", None)
                        if tuid and tuid in hidden_tool_ids:
                            continue
                        ev = {"type": "tool_result", "tool_use_id": tuid}
                        if tu_mode == "full":
                            ev["content"] = _flatten_result_content(getattr(block, "content", None))
                        if parent:
                            ev["parent"] = parent
                        yield ev
                for event in _task_events_from_result(getattr(message, "tool_use_result", None)):
                    if parent:
                        event["parent"] = parent
                    yield event
            elif isinstance(message, SystemMessage):
                subtype = getattr(message, "subtype", None)
                data = getattr(message, "data", None)
                if subtype == "compact_boundary":
                    meta = (data or {}).get("compactMetadata", {}) if isinstance(data, dict) else {}
                    yield {
                        "type": "compact",
                        "trigger": meta.get("trigger"),
                        "pre_tokens": meta.get("preTokens"),
                        "post_tokens": meta.get("postTokens"),
                        "summary": "",
                    }
                else:
                    yield {"type": "system", "subtype": subtype, "data": data}
            elif isinstance(message, ResultMessage):
                for ev in _flush_users(getattr(message, "session_id", None) or current_sid):
                    yield ev
                _cmd = [c for c in chips if str(c.get("sent") or "").lstrip().startswith("/")]
                if _cmd:
                    chips[:] = [c for c in chips if not str(c.get("sent") or "").lstrip().startswith("/")]
                    yield {"type": "dequeued", "ids": [c["id"] for c in _cmd if c["id"]], "text": "", "consumed": sum(1 for c in _cmd if c["drained"])}
                if emit is not None:
                    status_state["pending"].clear()
                if getattr(message, "is_error", None):
                    api_status = getattr(message, "api_error_status", None)
                    errs = getattr(message, "errors", None) or []
                    detail = "; ".join(e for e in errs if e) or (getattr(message, "result", None) or "")
                    if not detail and api_status:
                        detail = f"API error {api_status}"
                    if _looks_transient(api_status, detail):
                        yield {"type": "status", "kind": "failed"}
                sid = getattr(message, "session_id", None)
                ctx = None
                if sid and cwd:
                    try:
                        from services import sessions as _sessions
                        ctx = _sessions.last_context_tokens(_sessions.project_key_for(cwd), sid)
                    except Exception:
                        ctx = None
                yield {
                    "type": "result",
                    "session_id": sid,
                    "cost_usd": getattr(message, "total_cost_usd", None),
                    "is_error": getattr(message, "is_error", None),
                    "context_tokens": ctx,
                }
    except Exception as exc:
        logger.error(f"run_prompt failed: {type(exc).__name__}: {exc}")
        detail = getattr(exc, "stderr", None) or str(exc)
        if _looks_transient(None, detail):
            yield {"type": "status", "kind": "failed"}
        else:
            yield {"type": "error", "message": _clean_error_text(detail)}
    finally:
        if watchdog_task is not None:
            watchdog_task.cancel()


async def generate_title(transcript: str) -> str:
    """Ask a fast model for a short conversation title and return ONLY the text — the
    caller does the actual rename. Runs in the isolated AI workspace, so its session
    stays a plain SDK session under that project key (never normalized to "cli", never
    recorded in history like a chat) and is filtered out of the app's history."""
    from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage

    from services import accounts

    os.makedirs(AI_WORKDIR, exist_ok=True)
    options = ClaudeAgentOptions(
        cwd=AI_WORKDIR,
        permission_mode="default",
        model="haiku",
        system_prompt="You write conversation titles. Reply with ONLY the title: 3-6 words, Title Case, no quotes, no trailing punctuation.",
        setting_sources=[],
        cli_path=cli_manager.resolve_cli_path(),
        env=accounts.env_for(accounts.default_account()),
    )

    parts: list[str] = []
    try:
        async for message in query(prompt=f"Write a title for this conversation:\n\n{transcript}", options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if type(block).__name__ == "TextBlock":
                        parts.append(getattr(block, "text", ""))
    except Exception as exc:
        logger.error(f"generate_title failed: {type(exc).__name__}: {exc}")
    return "".join(parts).strip()


async def ask_side_question(
    question: str,
    context: str,
    resume_id: str | None = None,
    partial: bool = False,
    ask_user: Optional[Callable[[dict], Awaitable[dict]]] = None,
    account: Optional[str] = None,
) -> AsyncIterator[dict]:
    """Quick side question in an isolated, resumable session. ``context`` seeds the first turn,
    ``resume_id`` continues it for memory, ``ask_user`` surfaces permission prompts."""
    from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, StreamEvent, UserMessage, ResultMessage, HookMatcher
    from services import accounts

    os.makedirs(AI_WORKDIR, exist_ok=True)
    system = (
        "You are a helpful assistant answering a developer's quick questions, concisely and directly. "
        "<session_context> is recent messages from their current Claude Code session; use it when the "
        "question relates to that work, otherwise answer as a normal assistant. Never invent files, code, "
        "commands, or facts: if you don't know, say so plainly instead of guessing."
    )
    prompt = f"<session_context>\n{context}\n</session_context>\n\n{question}" if (context and not resume_id) else question
    options_kwargs: dict[str, Any] = dict(
        cwd=AI_WORKDIR,
        permission_mode="default",
        model="sonnet",
        system_prompt=None if resume_id else system,
        setting_sources=[],
        include_partial_messages=partial,
        cli_path=cli_manager.resolve_cli_path(),
        resume=resume_id,
        env=accounts.env_for(accounts.resolve(account)),
    )
    if ask_user is not None:
        options_kwargs["can_use_tool"] = _build_can_use_tool(ask_user)
        options_kwargs["hooks"] = {"PreToolUse": [HookMatcher(matcher=None, hooks=[_keep_stream_open])]}
    options = ClaudeAgentOptions(**options_kwargs)

    async def _prompt_stream():
        yield {"type": "user", "message": {"role": "user", "content": prompt}}
    prompt_arg = _prompt_stream() if ask_user is not None else prompt

    worked = False
    try:
        async for message in query(prompt=prompt_arg, options=options):
            if isinstance(message, StreamEvent):
                if not worked and _stream_event_is_working(message.event):
                    worked = True
                    yield {"type": "ask_working"}
                if partial:
                    for ev in _stream_event_to_events(message.event):
                        if ev.get("type") == "assistant_text" and ev.get("text"):
                            yield {"type": "ask_text", "text": ev["text"]}
            elif isinstance(message, AssistantMessage):
                if not worked and any(type(b).__name__ in ("ThinkingBlock", "ToolUseBlock") for b in message.content):
                    worked = True
                    yield {"type": "ask_working"}
                if not partial:
                    for block in message.content:
                        if type(block).__name__ == "TextBlock":
                            yield {"type": "ask_text", "text": getattr(block, "text", "")}
            elif isinstance(message, UserMessage):
                if not worked and any(type(b).__name__ == "ToolResultBlock" for b in (getattr(message, "content", None) or [])):
                    worked = True
                    yield {"type": "ask_working"}
            elif isinstance(message, ResultMessage):
                sid = getattr(message, "session_id", None)
                if sid:
                    yield {"type": "ask_session", "session_id": sid}
    except Exception as exc:
        logger.error(f"ask_side_question failed: {type(exc).__name__}: {exc}")
        yield {"type": "ask_text", "text": f"(error: {type(exc).__name__})"}


def _stream_event_is_working(ev) -> bool:
    """True for raw stream events that mark thinking or tool activity."""
    if not isinstance(ev, dict):
        return False
    if ev.get("type") == "content_block_start":
        return ((ev.get("content_block") or {}).get("type")) in ("thinking", "redacted_thinking", "tool_use", "server_tool_use")
    if ev.get("type") == "content_block_delta":
        return ((ev.get("delta") or {}).get("type")) == "thinking_delta"
    return False
