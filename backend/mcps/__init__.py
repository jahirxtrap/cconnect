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
from typing import Any, Iterable, Optional

from mcps import components

SETTING = "mcp_disabled"

_FIRST_SENTENCE = re.compile(r"\s*(.+?[.!?])(?:\s|$)", re.DOTALL)


def _tool_name(tool: Any) -> str:
    return getattr(tool, "name", None) or getattr(tool, "__name__", "")


def _tool_summary(tool: Any) -> str:
    """The opening sentence of the tool's description."""
    text = getattr(tool, "description", "") or ""
    match = _FIRST_SENTENCE.match(text)
    return " ".join((match.group(1) if match else text).split())


def _discover(context: dict) -> list[tuple[Any, Any]]:
    """Every tool a turn with this context exposes, paired with the module providing it."""
    collected: list[tuple[Any, Any]] = []
    for info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{info.name}")
        make_tools = getattr(module, "make_tools", None)
        tools = make_tools(context) if make_tools else getattr(module, "tools", None)
        collected.extend((module, tool) for tool in tools or [])
    return collected


def disabled_tools() -> set[str]:
    from services import settings_store

    raw = settings_store.get(SETTING) or ""
    return {name.strip() for name in raw.split(",") if name.strip()}


def tool_specs(capabilities: Iterable[str] = ()) -> list[dict]:
    """Every tool the server can expose to a client with these capabilities."""
    probe = {
        "request_compact": lambda *_args: None,
        "session_info": lambda: {},
        "emit": lambda *_args, **_kwargs: None,
        "ask_user": lambda *_args, **_kwargs: None,
        "account": None,
        "capabilities": [components.CAPABILITY, *capabilities],
    }
    specs: dict[str, dict] = {}
    for module, tool in _discover(probe):
        name = _tool_name(tool)
        if name and name not in specs:
            specs[name] = {
                "name": name,
                "description": _tool_summary(tool),
                "group": getattr(module, "GROUP", None),
                "group_description": getattr(module, "GROUP_SUMMARY", None),
            }
    return [specs[name] for name in sorted(specs)]


def build_cconnect_server(context: Optional[dict] = None, exclude: Iterable[str] = ()) -> Any:
    from claude_agent_sdk import create_sdk_mcp_server

    hidden = disabled_tools() | set(exclude)
    collected = [tool for _module, tool in _discover(context or {}) if _tool_name(tool) not in hidden]
    return create_sdk_mcp_server(name="cconnect", version="1.0.0", tools=collected)
