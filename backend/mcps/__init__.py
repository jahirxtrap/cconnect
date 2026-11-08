"""Auto-discovers tools from sibling modules and assembles the cconnect MCP server.
Drop a new .py file here exposing `make_tools(context)` and it's picked up on next
backend start — no manual registration. It gets built fresh on every turn, and
returns an empty list to hide its tools from turns it can't serve.

`mcp_disabled` (a settings list of tool names) hides tools from Claude without
touching this file, so a new tool needs no client change to become configurable."""

import importlib
import pkgutil
import re
from typing import Any, Iterable, Optional

from mcps import components
from mcps.definition import Definition

SETTING = "mcp_disabled"
SERVER = "cconnect"
LIST_TOOLS = "tools/list"
ALWAYS_LOAD = "anthropic/alwaysLoad"

_FIRST_SENTENCE = re.compile(r"\s*(.+?[.!?])(?:\s|$)", re.DOTALL)
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")
_TOOL_PREFIX = f"mcp__{SERVER}__"


def _tool_name(tool: Any) -> str:
    return getattr(tool, "name", None) or getattr(tool, "__name__", "")


def _tool_summary(tool: Any) -> str:
    """The opening sentence of the tool's description."""
    text = getattr(tool, "description", "") or ""
    match = _FIRST_SENTENCE.match(text)
    return " ".join((match.group(1) if match else text).split())


def _tool_opening(tool: Any) -> str:
    text = (getattr(tool, "description", "") or "").strip()
    return " ".join(_PARAGRAPH_BREAK.split(text, 1)[0].split())


def _modules() -> list[Any]:
    return [importlib.import_module(f"{__name__}.{info.name}") for info in pkgutil.iter_modules(__path__)]


def _definitions() -> dict[str, Definition]:
    return {
        value.name: value
        for module in _modules()
        for value in vars(module).values()
        if isinstance(value, Definition)
    }


def _declared(tool: Any, definitions: dict[str, Definition], flag: str) -> bool:
    return getattr(definitions.get(_tool_name(tool)), flag, False)


def _discover(context: dict) -> list[tuple[Any, Any]]:
    """Every tool a turn with this context exposes, paired with the module providing it."""
    collected: list[tuple[Any, Any]] = []
    for module in _modules():
        make_tools = getattr(module, "make_tools", None)
        collected.extend((module, tool) for tool in (make_tools(context) if make_tools else []))
    return collected


def _probe(capabilities: Iterable[str]) -> dict:
    return {
        "request_compact": lambda *_args: None,
        "session_info": lambda: {},
        "emit": lambda *_args, **_kwargs: None,
        "ask_user": lambda *_args, **_kwargs: None,
        "account": None,
        "capabilities": list(capabilities),
    }


def needs_key(tool: str, args: Any) -> bool:
    if not tool.startswith(_TOOL_PREFIX):
        return False
    name = tool[len(_TOOL_PREFIX):]
    given = args if isinstance(args, dict) else {}
    return any(module.needs_key(name, given) for module in _modules() if hasattr(module, "needs_key"))


def disabled_tools() -> set[str]:
    from services import settings_store

    raw = settings_store.get(SETTING) or ""
    return {name.strip() for name in raw.split(",") if name.strip()}


def tool_specs(capabilities: Iterable[str] = ()) -> list[dict]:
    """Every tool the server can expose to a client with these capabilities."""
    specs: dict[str, dict] = {}
    for module, tool in _discover(_probe([components.CAPABILITY, *capabilities])):
        name = _tool_name(tool)
        if name and name not in specs:
            specs[name] = {
                "name": name,
                "description": _tool_summary(tool),
                "group": getattr(module, "GROUP", None),
                "group_description": getattr(module, "GROUP_SUMMARY", None),
            }
    return [specs[name] for name in sorted(specs)]


def tool_guides(capabilities: Iterable[str]) -> list[str]:
    hidden = disabled_tools()
    definitions = _definitions()
    return [
        f"- `{_tool_name(tool)}`: {_tool_opening(tool)}"
        for _module, tool in _discover(_probe(capabilities))
        if _tool_name(tool) not in hidden and _declared(tool, definitions, "guide")
    ]


def _load_up_front(server: Any, names: set[str]) -> None:
    entry = server.get_request_handler(LIST_TOOLS)

    async def listed(ctx: Any, params: Any) -> Any:
        result = await entry.handler(ctx, params)
        for item in result.tools:
            if item.name in names:
                item.meta = {**(item.meta or {}), ALWAYS_LOAD: True}
        return result

    server.add_request_handler(LIST_TOOLS, entry.params_type, listed)


def build_cconnect_server(
    context: Optional[dict] = None,
    exclude: Iterable[str] = (),
    only: Optional[Iterable[str]] = None,
) -> Any:
    from claude_agent_sdk import create_sdk_mcp_server

    hidden = disabled_tools() | set(exclude)
    wanted = None if only is None else set(only)
    collected = [
        (module, tool)
        for module, tool in _discover(context or {})
        if _tool_name(tool) not in hidden and (wanted is None or _tool_name(tool) in wanted)
    ]
    definitions = _definitions()
    config = create_sdk_mcp_server(name=SERVER, version="1.0.0", tools=[tool for _module, tool in collected])
    _load_up_front(config["instance"], {_tool_name(tool) for _module, tool in collected if _declared(tool, definitions, "eager")})
    return config
