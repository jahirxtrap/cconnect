"""Shells on the machine running the backend, for the clients that can show them."""

from mcps.definition import Definition, reply
from services import terminal

CAPABILITY = "terminal"
GROUP = "terminal"
GROUP_SUMMARY = "Open shells on the user's machine, run commands in them and read what they print."

DEFAULT_TAIL = 4000
SETTLE_SECONDS = 1.0

TERMINAL_ID = {"type": "string", "description": "The terminal, from terminal_open or terminal_list."}

TERMINAL_OPEN = Definition(
    "terminal_open",
    "Open a shell on the user's machine and leave it running in their terminal panel. Use it for"
    " anything that should outlive this turn: a dev server, a build that takes minutes, a watcher."
    " It returns right away with an id, so start it and keep working; read it later with"
    " terminal_read. For a command you need the result of now, use Bash instead.",
    {
        "type": "object",
        "properties": {
            "cwd": {"type": "string", "description": "Directory it starts in. The default project when left out."},
            "title": {"type": "string", "description": "Name on its tab. The folder name when left out."},
        },
    },
)

TERMINAL_RUN = Definition(
    "terminal_run",
    "Type a command into an open terminal and press enter. The call returns as soon as it is sent,"
    " not when the command finishes, so read the output afterwards with terminal_read.",
    {
        "type": "object",
        "properties": {
            "id": TERMINAL_ID,
            "command": {"type": "string", "description": "The line to type, sent as if the user typed it."},
        },
        "required": ["id", "command"],
    },
)

TERMINAL_READ = Definition(
    "terminal_read",
    "What an open terminal shows right now, escape sequences already stripped. Call it to check on"
    " something you started earlier, or to see why it failed.",
    {
        "type": "object",
        "properties": {
            "id": TERMINAL_ID,
            "limit": {"type": "integer", "description": f"Characters from the end. {DEFAULT_TAIL} by default."},
        },
        "required": ["id"],
    },
)

TERMINAL_LIST = Definition(
    "terminal_list",
    "The terminals open on the user's machine, with the directory each one runs in and whether it"
    " is busy. Call it when you need the id of one you or the user started.",
)

TERMINAL_CLOSE = Definition(
    "terminal_close",
    "Close a terminal and stop whatever runs in it. Only for terminals you opened yourself, unless"
    " the user asks for one of theirs.",
    {
        "type": "object",
        "properties": {"id": {"type": "string", "description": "The terminal to close."}},
        "required": ["id"],
    },
)


def needs_key(name: str, args: dict) -> bool:
    return name.startswith(f"{CAPABILITY}_")


def _describe(meta: dict) -> str:
    state = "busy" if meta["busy"] else "idle" if meta["alive"] else "exited"
    return f"{meta['id']}  {meta['title']}  {meta['cwd']}  {state}"


def make_tools(context: dict) -> list:
    if CAPABILITY not in (context.get("capabilities") or ()):
        return []

    session_info = context.get("session_info")
    emit = context.get("emit")

    @TERMINAL_OPEN
    async def terminal_open(args):
        chat_cwd = (session_info() or {}).get("cwd") if session_info else None
        try:
            created = terminal.create(cwd=[args.get("cwd"), chat_cwd], title=args.get("title"))
        except (ValueError, OSError) as exc:
            return reply(f"Could not open a terminal: {exc}")
        if emit is not None:
            await emit({"type": "terminal_opened", **created})
        return reply(f"Opened {created['id']} running {created['shell']} in {created['cwd']}.")

    @TERMINAL_RUN
    async def terminal_run(args):
        term = terminal.get(args["id"])
        if term is None:
            return reply("That terminal is not open.")
        if not term.alive:
            return reply("That terminal has exited.")
        term.write(f"{args['command']}\r".encode("utf-8"))
        return reply("Sent. Read the output with terminal_read.")

    @TERMINAL_READ
    async def terminal_read(args):
        term = terminal.get(args["id"])
        if term is None:
            return reply("That terminal is not open.")
        limit = args.get("limit")
        body = term.tail(limit if isinstance(limit, int) and limit > 0 else DEFAULT_TAIL)
        return reply(body or "Nothing has been printed yet.")

    @TERMINAL_LIST
    async def terminal_list(args):
        rows = terminal.listing()
        return reply("\n".join(_describe(row) for row in rows) or "No terminals are open.")

    @TERMINAL_CLOSE
    async def terminal_close(args):
        return reply("Closed." if terminal.close(args["id"]) else "That terminal is not open.")

    return [terminal_open, terminal_run, terminal_read, terminal_list, terminal_close]
