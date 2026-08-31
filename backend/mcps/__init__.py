"""Auto-discovers tools from sibling modules and assembles the cconnect MCP server.
Drop a new .py file here exposing `tools = [<decorated_fn>, ...]` and it's picked
up on next backend start — no manual registration. A tool that has to reach the
turn running it exposes `make_tools(context)` instead, gets built fresh on every
turn, and returns an empty list to hide itself from turns it can't serve.

`mcp_disabled` (a settings list of tool names) hides tools from Claude without
touching this file, so a new tool needs no client change to become configurable."""

import importlib
import pkgutil
import re
from typing import Any, Optional

from mcps import components

SETTING = "mcp_disabled"

_FIRST_SENTENCE = re.compile(r"\s*(.+?[.!?])(?:\s|$)", re.DOTALL)


def _tool_name(tool: Any) -> str:
    return getattr(tool, "name", None) or getattr(tool, "__name__", "")


def _tool_summary(tool: Any) -> str:
    """The opening sentence of the tool's prompt, which is what reads as a label."""
    text = getattr(tool, "description", "") or ""
    match = _FIRST_SENTENCE.match(text)
    return " ".join((match.group(1) if match else text).split())


def _discover(context: dict) -> list:
    collected: list = []
    for info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{info.name}")
        make_tools = getattr(module, "make_tools", None)
        tools = make_tools(context) if make_tools else getattr(module, "tools", None)
        if tools:
            collected.extend(tools)
    return collected


def disabled_tools() -> set[str]:
    from services import settings_store

    raw = settings_store.get(SETTING) or ""
    return {name.strip() for name in raw.split(",") if name.strip()}


def tool_specs() -> list[dict]:
    """Every tool the server can expose, including the ones a real turn would gate out."""
    probe = {
        "request_compact": lambda: None,
        "session_info": lambda: {},
        "emit": lambda *_args, **_kwargs: None,
        "ask_user": lambda *_args, **_kwargs: None,
        "account": None,
        "capabilities": [components.CAPABILITY],
    }
    summaries: dict[str, str] = {}
    for tool in _discover(probe):
        name = _tool_name(tool)
        if name and name not in summaries:
            summaries[name] = _tool_summary(tool)
    return [{"name": name, "description": summaries[name]} for name in sorted(summaries)]


def build_cconnect_server(context: Optional[dict] = None) -> Any:
    from claude_agent_sdk import create_sdk_mcp_server

    hidden = disabled_tools()
    collected = [tool for tool in _discover(context or {}) if _tool_name(tool) not in hidden]
    return create_sdk_mcp_server(name="cconnect", version="1.0.0", tools=collected)
