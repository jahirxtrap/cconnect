"""Shells on the machine running the backend, for the clients that can show them."""

from typing import Optional

from claude_agent_sdk import tool

from services import terminal

CAPABILITY = "terminal"
GROUP = "terminal"
GROUP_SUMMARY = "Open shells on the user's machine, run commands in them and read what they print."

DEFAULT_TAIL = 4000
SETTLE_SECONDS = 1.0

OPEN = (
    "Open a shell on the user's machine and leave it running in their terminal panel. Use it for"
    " anything that should outlive this turn: a dev server, a build that takes minutes, a watcher."
    " It returns right away with an id, so start it and keep working; read it later with"
    " terminal_read. For a command you need the result of now, use Bash instead."
)

RUN = (
    "Type a command into an open terminal and press enter. The call returns as soon as it is sent,"
    " not when the command finishes, so read the output afterwards with terminal_read."
)

READ = (
    "What an open terminal shows right now, escape sequences already stripped. Call it to check on"
    " something you started earlier, or to see why it failed."
)

LIST = (
    "The terminals open on the user's machine, with the directory each one runs in and whether it"
    " is busy. Call it when you need the id of one you or the user started."
)

CLOSE = (
    "Close a terminal and stop whatever runs in it. Only for terminals you opened yourself, unless"
    " the user asks for one of theirs."
)

OPEN_SCHEMA = {
    "type": "object",
    "properties": {
        "cwd": {"type": "string", "description": "Directory it starts in. The default project when left out."},
        "title": {"type": "string", "description": "Name on its tab. The folder name when left out."},
    },
}

RUN_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "description": "The terminal, from terminal_open or terminal_list."},
        "command": {"type": "string", "description": "The line to type, sent as if the user typed it."},
    },
    "required": ["id", "command"],
}

READ_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "description": "The terminal, from terminal_open or terminal_list."},
        "limit": {"type": "integer", "description": f"Characters from the end. {DEFAULT_TAIL} by default."},
    },
    "required": ["id"],
}

CLOSE_SCHEMA = {
    "type": "object",
    "properties": {"id": {"type": "string", "description": "The terminal to close."}},
    "required": ["id"],
}


def authorize(capabilities: list[str], key: Optional[str]) -> list[str]:
    """The capabilities a turn really gets: terminal only survives with the unlock key."""
    if CAPABILITY in capabilities and not terminal.key_matches(key or ""):
        return [item for item in capabilities if item != CAPABILITY]
    return list(capabilities)


def _text(body: str) -> dict:
    return {"content": [{"type": "text", "text": body}]}


def _describe(meta: dict) -> str:
    state = "busy" if meta["busy"] else "idle" if meta["alive"] else "exited"
    return f"{meta['id']}  {meta['title']}  {meta['cwd']}  {state}"


def make_tools(context: dict) -> list:
    if CAPABILITY not in (context.get("capabilities") or ()):
        return []

    session_info = context.get("session_info")
    emit = context.get("emit")

    @tool("terminal_open", OPEN, OPEN_SCHEMA)
    async def terminal_open(args):
        chat_cwd = (session_info() or {}).get("cwd") if session_info else None
        try:
            created = terminal.create(cwd=[args.get("cwd"), chat_cwd], title=args.get("title"))
        except (ValueError, OSError) as exc:
            return _text(f"Could not open a terminal: {exc}")
        if emit is not None:
            await emit({"type": "terminal_opened", **created})
        return _text(f"Opened {created['id']} running {created['shell']} in {created['cwd']}.")

    @tool("terminal_run", RUN, RUN_SCHEMA)
    async def terminal_run(args):
        term = terminal.get(args["id"])
        if term is None:
            return _text("That terminal is not open.")
        if not term.alive:
            return _text("That terminal has exited.")
        term.write(f"{args['command']}\r".encode("utf-8"))
        return _text("Sent. Read the output with terminal_read.")

    @tool("terminal_read", READ, READ_SCHEMA)
    async def terminal_read(args):
        term = terminal.get(args["id"])
        if term is None:
            return _text("That terminal is not open.")
        limit = args.get("limit")
        body = term.tail(limit if isinstance(limit, int) and limit > 0 else DEFAULT_TAIL)
        return _text(body or "Nothing has been printed yet.")

    @tool("terminal_list", LIST, {})
    async def terminal_list(args):
        rows = terminal.listing()
        return _text("\n".join(_describe(row) for row in rows) or "No terminals are open.")

    @tool("terminal_close", CLOSE, CLOSE_SCHEMA)
    async def terminal_close(args):
        return _text("Closed." if terminal.close(args["id"]) else "That terminal is not open.")

    return [terminal_open, terminal_run, terminal_read, terminal_list, terminal_close]
