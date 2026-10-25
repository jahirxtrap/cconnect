import asyncio
from contextlib import suppress
from typing import Optional

from claude_agent_sdk import tool

from core import display, paths
from services import delegate_runner, delegate_runs, delegates, sessions, tool_calls, visibility

CLAIM_TIMEOUT = 10.0
DESCRIPTION_LIMIT = 160
CHECKED_FIELDS = ("kind", "command", *delegates.ARG_LISTS)
CHANGEABLE = ("name", "description", *CHECKED_FIELDS)

SUMMARIES = {
    sessions.TASK_COMPLETED: "{name} finished",
    sessions.TASK_FAILED: "{name} could not finish",
    sessions.TASK_STOPPED: "{name} was stopped by the user",
}

KIND_WORDS = {
    "model": "a model that only answers, no tools",
    "claude": "Claude Code on another account, with tools",
    "command": "an agent CLI",
    "acp": "an agent over the Agent Client Protocol",
}

DESCRIPTION = (
    "Hand a task to another AI the user set up, and get its answer back. Use it when the user asks "
    "for one of these destinations by name, wants a second opinion, or a subtask suits one of them "
    "better. The destination works in this chat's folder with this chat's permissions: what this "
    "chat does without asking it does too, and what this chat would ask about is asked to the user. "
    "Its steps appear inside this call.{background} When the user names an AI that is not listed, register it: "
    "find its executable and how it runs with nobody at the keyboard, as an Agent Client Protocol "
    "server or as a command that takes one task and prints only its final answer, with the flags "
    "that leave its progress out. The server runs a small task on it and only saves it if it "
    "answers, so a failed registration says what to fix. When the user asks to change or drop a "
    "destination, update it with only what changes, or remove it."
    "\n\nDestinations:\n{destinations}"
)

NO_DESTINATIONS = "None yet: register one when the user asks for it."

BACKGROUND = (
    " With background it works while this chat carries on, the user can stop it meanwhile, and its "
    "answer arrives as a task notification when it finishes."
)

BACKGROUND_FIELD = {
    "type": "boolean",
    "description": "run: hand the task over and carry on instead of waiting for the answer.",
}

BACKGROUND_REPLY = "{name} is working on it in the background. Its answer arrives as a task notification when it finishes."

SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["run", "register", "update", "remove"],
            "description": (
                "run hands a task to a destination, register adds one, update changes one and remove deletes one. "
                "run when left out."
            ),
        },
        "destination": {"type": "string", "description": "run, update and remove: the id of one of the destinations listed."},
        "task": {
            "type": "string",
            "description": "run: what it has to do, written whole: the destination does not see this conversation.",
        },
        "name": {"type": "string", "description": "register and update: the name the user calls it by."},
        "kind": {
            "type": "string",
            "enum": list(delegates.REGISTERABLE),
            "description": "register and update: command for a CLI that takes one task and prints the answer, acp for an Agent Client Protocol server.",
        },
        "command": {"type": "string", "description": "register and update: its executable, by name on the PATH or by full path."},
        "args": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                f"register and update: its arguments while it may only read. A command gets the task on stdin, or in "
                f"place of {delegates.TASK_TOKEN} inside one of them."
            ),
        },
        "edit_args": {
            "type": "array",
            "items": {"type": "string"},
            "description": "register and update, command only: its arguments while it may also edit files, for a chat that accepts edits.",
        },
        "bypass_args": {
            "type": "array",
            "items": {"type": "string"},
            "description": "register and update, command only: its arguments while it may act without asking, for a chat that bypasses permissions.",
        },
        "description": {"type": "string", "description": "register and update: what it is good at, in one line."},
    },
}


def _line(entry: dict) -> str:
    about = entry["description"][:DESCRIPTION_LIMIT]
    return f"- {entry['id']}: {entry['name']} ({KIND_WORDS[entry['kind']]})" + (f". {about}" if about else "")


def _reply(text: str, error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], **({"is_error": True} if error else {})}


def make_tools(context: dict) -> list:
    entries = delegates.enabled()
    emit = context.get("emit")
    ask = context.get("ask_user")
    session_info = context.get("session_info")
    wanted = context.get("visibility")
    background = context.get("background")
    schema = {**SCHEMA, "properties": {**SCHEMA["properties"], "background": BACKGROUND_FIELD}} if background else SCHEMA

    def info() -> dict:
        return (session_info() if session_info else None) or {}

    def cwd() -> str:
        return info().get("cwd") or str(paths.AI_WORKDIR)

    async def keep(session_id: str, parent: str) -> None:
        with suppress(OSError):
            await asyncio.to_thread(delegate_runs.save, session_id, parent)

    def vis() -> dict:
        return (wanted or visibility.defaults)()

    async def register(args: dict) -> dict:
        name = (args.get("name") or "").strip()
        entry = delegates.clean({
            "id": delegates.slug(name),
            "name": name,
            "kind": args.get("kind"),
            "command": args.get("command"),
            **{key: args.get(key) or [] for key in delegates.ARG_LISTS},
            "description": args.get("description") or "",
        })
        if entry is None or entry["kind"] not in delegates.REGISTERABLE or not entry["command"]:
            return _reply("Give the name, the kind (command or acp) and the command to register.", error=True)
        failed = await checked(entry)
        if failed is not None:
            return failed
        delegates.upsert(entry)
        return _reply(f"{entry['name']} is registered as {entry['id']}: hand it tasks with that destination.")

    async def checked(entry: dict) -> Optional[dict]:
        try:
            await delegate_runner.check(entry, cwd(), vis())
        except delegate_runner.DelegateError as exc:
            return _reply(f"{entry['name']} did not pass the check: {exc}", error=True)
        return None

    async def update(args: dict) -> dict:
        found = delegates.stored(args.get("destination") or "")
        if found is None:
            return _reply("Name one of the destinations listed to update.", error=True)
        changes = {key: args[key] for key in CHANGEABLE if args.get(key) is not None}
        if changes.get("kind") not in (None, *delegates.REGISTERABLE):
            return _reply("The kind can only change to command or acp.", error=True)
        entry = delegates.clean({**found, **changes})
        if entry is None or not entry["name"]:
            return _reply("The name cannot be empty.", error=True)
        if any(entry[key] != found[key] for key in CHECKED_FIELDS):
            failed = await checked(entry)
            if failed is not None:
                return failed
        delegates.upsert(entry)
        return _reply(f"{entry['name']} ({entry['id']}) is updated.")

    def remove(args: dict) -> dict:
        found = delegates.remove(args.get("destination") or "")
        if found is None:
            return _reply("Name one of the destinations listed to remove.", error=True)
        return _reply(f"{found['name']} ({found['id']}) is removed.")

    @tool(
        delegates.TOOL,
        DESCRIPTION.format(
            background=BACKGROUND if background else "",
            destinations="\n".join(map(_line, entries)) or NO_DESTINATIONS,
        ),
        schema,
    )
    async def delegate(args):
        action = args.get("action")
        if action == "register":
            return await register(args)
        if action == "update":
            return await update(args)
        if action == "remove":
            return remove(args)
        destination = delegates.find(args.get("destination") or "")
        task = (args.get("task") or "").strip()
        if destination is None or not task:
            return _reply("Name one of the destinations listed and a task.", error=True)
        name = destination["name"]
        parent = await tool_calls.claim(delegates.TOOL_ID, args, CLAIM_TIMEOUT)
        session_id = info().get("session_id") or ""
        where, seen = cwd(), vis()
        mode = info().get("permission_mode") or delegate_runner.DEFAULT_MODE
        steps = delegate_runs.follow(session_id, parent) if parent else []

        async def run(emit_to, ask_with) -> str:
            async def report(event: dict) -> None:
                steps.append(event)
                if emit_to is not None and parent:
                    await emit_to({**event, "parent": parent})

            try:
                return await delegate_runner.run(destination, task, delegate_runner.Turn(where, seen, report, mode, ask_with))
            finally:
                if parent:
                    await keep(session_id, parent)

        def summary(status: str) -> str:
            return SUMMARIES[status].format(name=name)

        if args.get("background") and background and parent:
            label = display.joined(*delegates.label_of(args))
            if await background(parent, label, run, summary):
                return _reply(BACKGROUND_REPLY.format(name=name))
        try:
            answer = await run(emit, ask)
        except delegate_runner.DelegateError as exc:
            return _reply(f"{summary(sessions.TASK_FAILED)}: {exc}", error=True)
        return _reply(answer or f"{name} finished without an answer.")

    return [delegate]
