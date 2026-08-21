"""Auto-discovers tools from sibling modules and assembles the cconnect MCP server.
Drop a new .py file here exposing `tools = [<decorated_fn>, ...]` and it's picked
up on next backend start — no manual registration. A tool that has to reach the
turn running it exposes `make_tools(context)` instead, gets built fresh on every
turn, and returns an empty list to hide itself from turns it can't serve."""

import importlib
import pkgutil
from typing import Any, Optional


def build_cconnect_server(context: Optional[dict] = None) -> Any:
    from claude_agent_sdk import create_sdk_mcp_server

    context = context or {}
    collected: list = []
    for info in pkgutil.iter_modules(__path__):
        module = importlib.import_module(f"{__name__}.{info.name}")
        make_tools = getattr(module, "make_tools", None)
        tools = make_tools(context) if make_tools else getattr(module, "tools", None)
        if tools:
            collected.extend(tools)
    return create_sdk_mcp_server(name="cconnect", version="1.0.0", tools=collected)
