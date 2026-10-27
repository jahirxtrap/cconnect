import asyncio
from contextlib import suppress
from typing import Optional

from claude_agent_sdk import tool

from core import display, paths
from services import (
    accounts,
    agent_registry,
    agents,
    delegate_runner,
    delegate_runs,
    delegates,
    sessions,
    tool_calls,
    visibility,
)
from services.agent_connections import pool

CLAIM_TIMEOUT = 10.0
DESCRIPTION_LIMIT = 160
CHECKED_FIELDS = ("protocol", "program", *agents.ARG_LISTS)

SUMMARIES = {
    sessions.TASK_COMPLETED: "{name} finished",
    sessions.TASK_FAILED: "{name} could not finish",
    sessions.TASK_STOPPED: "{name} was stopped by the user",
}

KIND_WORDS = {
    agents.ACP: "an agent over the Agent Client Protocol",
    agents.COMMAND: "an agent CLI",
    delegates.ACCOUNT: "Claude on another account: with tools it reads this chat's folder, without them it only answers",
}

DESCRIPTION = (
    "Hand a task to another AI the user set up, and get its answer back. Use it when the user asks "
    "for one of these destinations by name, wants a second opinion, or a subtask suits one of them "
    "better. The destination works in this chat's folder with this chat's permissions: what this "
    "chat does without asking it does too, and what this chat would ask about is asked to the user. "
    "Its steps appear inside this call.{background} When the user names an AI that is not listed, look for it "
    "in the catalog of Agent Client Protocol agents and install it. If it is not there, register it: find its "
    "executable and how it runs with nobody at the keyboard, as an Agent Client Protocol server or as a command "
    "that takes one task and prints only its final answer, with the flags that leave its progress out. Take those "
    "flags from its own help or official documentation, never from memory or a template, since they change between "
    "versions. The server runs a small task on it and only saves it if it answers, so a failed registration says "
    "what to fix. When the user asks to change or drop a destination, update it with only what changes, or remove it."
    "\n\nDestinations:\n{destinations}"
)

NO_DESTINATIONS = "None yet: install or register one when the user asks for it."

BACKGROUND = (
    " With background it works while this chat carries on, the user can stop it meanwhile, and its "
    "answer arrives as a task notification when it finishes."
)

BACKGROUND_FIELD = {
    "type": "boolean",
    "description": "run: hand the task over and carry on instead of waiting for the answer.",
}

BACKGROUND_REPLY = "{name} is working on it in the background. Its answer arrives as a task notification when it finishes."

NEEDS_WORDS = {
    agent_registry.NEEDS_NODE: "needs Node.js on this machine",
    agent_registry.NEEDS_PLATFORM: "not available for this system",
}

SCHEMA = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["run", "catalog", "install", "register", "update", "remove"],
            "description": (
                "run hands a task to a destination, catalog lists the agents that can be installed, install adds one "
                "of them, register adds an agent by hand, update changes a destination and remove drops it. "
                "run when left out."
            ),
        },
        "destination": {
            "type": "string",
            "description": "run, update and remove: the id of one of the destinations listed. install: the id from the catalog.",
        },
        "task": {
            "type": "string",
            "description": "run: what it has to do, written whole: the destination does not see this conversation.",
        },
        "tools": {
            "type": "boolean",
            "description": "run, Claude accounts only: false to only get an answer, without reading anything. true when left out.",
        },
        "name": {"type": "string", "description": "register and update: the name the user calls it by."},
        "kind": {
            "type": "string",
            "enum": list(agents.PROTOCOLS),
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


def _offer(item: dict) -> str:
    _kind, _spec, needs = agent_registry.runnable(item)
    notes = [NEEDS_WORDS[needs]] if needs in NEEDS_WORDS else []
    installed = agents.find(item["id"])
    if installed is not None:
        notes.append(f"installed, version {installed['version']}")
    about = str(item.get("description") or "")[:DESCRIPTION_LIMIT]
    return f"- {item['id']}: {item.get('name') or item['id']}" + (f" ({', '.join(notes)})" if notes else "") + (f". {about}" if about else "")


def _reply(text: str, error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], **({"is_error": True} if error else {})}


def _failure(exc: agents.AgentError) -> str:
    return f"{exc.reason}: {exc.detail}" if exc.detail else exc.reason


def make_tools(context: dict) -> list:
    entries = delegates.destinations()
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

    async def checked(agent: dict) -> Optional[str]:
        destination = delegates.find(agent["id"])
        if destination is None:
            return "it is turned off"
        try:
            await delegate_runner.check(destination, cwd(), vis())
        except delegate_runner.DelegateError as exc:
            return str(exc)
        return None

    async def catalog() -> dict:
        try:
            items = await asyncio.to_thread(agent_registry.catalog)
        except agent_registry.RegistryError as exc:
            return _reply(f"The catalog could not be read: {exc}", error=True)
        return _reply("Agents that can be installed:\n" + "\n".join(map(_offer, items)))

    async def install(args: dict) -> dict:
        ident = (args.get("destination") or "").strip()
        if not ident:
            return _reply("Give the id of an agent from the catalog.", error=True)
        await pool.restart(ident)
        try:
            agent = await asyncio.to_thread(agents.install, ident)
        except agents.AgentError as exc:
            return _reply(f"{ident} could not be installed: {_failure(exc)}", error=True)
        except OSError as exc:
            return _reply(f"{ident} could not be installed: {exc}", error=True)
        failed = await checked(agent)
        if failed is not None:
            return _reply(
                f"{agent['name']} is installed as {agent['id']}, but it did not answer a small task: {failed}. "
                "If it asks to sign in, the user signs in from the ACP agents panel."
            )
        return _reply(f"{agent['name']} is installed as {agent['id']}: hand it tasks with that destination.")

    async def register(args: dict) -> dict:
        name = (args.get("name") or "").strip()
        program = (args.get("command") or "").strip()
        protocol = args.get("kind")
        if not name or not program or protocol not in agents.PROTOCOLS:
            return _reply("Give the name, the kind (command or acp) and the command to register.", error=True)
        agent = agents.add({
            "name": name,
            "protocol": protocol,
            "purpose": (args.get("description") or "").strip(),
            "program": program,
            **{key: [str(arg) for arg in args.get(key) or []] for key in agents.ARG_LISTS},
        })
        failed = await checked(agent)
        if failed is not None:
            agents.remove(agent["id"])
            return _reply(f"{agent['name']} did not pass the check: {failed}", error=True)
        return _reply(f"{agent['name']} is registered as {agent['id']}: hand it tasks with that destination.")

    async def update_agent(agent: dict, args: dict) -> dict:
        fields = {"name": "name", "kind": "protocol", "description": "purpose", "command": "program", **{key: key for key in agents.ARG_LISTS}}
        changes = {field: args[key] for key, field in fields.items() if args.get(key) is not None}
        updated = agents.update(agent["id"], changes)
        if updated is None:
            return _reply("Name one of the destinations listed to update.", error=True)
        if any(updated[key] != agent[key] for key in CHECKED_FIELDS):
            await pool.restart(agent["id"])
            failed = await checked(updated)
            if failed is not None:
                agents.update(agent["id"], {key: agent[key] for key in changes})
                return _reply(f"{updated['name']} did not pass the check: {failed}", error=True)
        return _reply(f"{updated['name']} ({updated['id']}) is updated.")

    async def update(args: dict) -> dict:
        destination = delegates.find(args.get("destination") or "")
        if destination is None:
            return _reply("Name one of the destinations listed to update.", error=True)
        if destination["kind"] != delegates.ACCOUNT:
            return await update_agent(destination, args)
        accounts.set_delegation(destination["account"], True, args.get("description") or destination["description"])
        return _reply(f"{destination['name']} ({destination['id']}) is updated.")

    async def remove(args: dict) -> dict:
        destination = delegates.find(args.get("destination") or "")
        if destination is None:
            return _reply("Name one of the destinations listed to remove.", error=True)
        if destination["kind"] == delegates.ACCOUNT:
            accounts.set_delegation(destination["account"], False, destination["description"])
        else:
            await pool.restart(destination["id"])
            agents.remove(destination["id"])
        return _reply(f"{destination['name']} ({destination['id']}) is removed.")

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
        if action == "catalog":
            return await catalog()
        if action == "install":
            return await install(args)
        if action == "register":
            return await register(args)
        if action == "update":
            return await update(args)
        if action == "remove":
            return await remove(args)
        destination = delegates.find(args.get("destination") or "")
        task = (args.get("task") or "").strip()
        if destination is None or not task:
            return _reply("Name one of the destinations listed and a task.", error=True)
        name = destination["name"]
        parent = await tool_calls.claim(delegates.TOOL_ID, args, CLAIM_TIMEOUT)
        session_id = info().get("session_id") or ""
        where, seen = cwd(), vis()
        mode = info().get("permission_mode") or delegate_runner.DEFAULT_MODE
        tools = args.get("tools") is not False
        steps = delegate_runs.follow(session_id, parent) if parent else []

        async def run(emit_to, ask_with) -> str:
            async def report(event: dict) -> None:
                steps.append(event)
                if emit_to is not None and parent:
                    await emit_to({**event, "parent": parent})

            try:
                return await delegate_runner.run(
                    destination, task, delegate_runner.Turn(where, seen, report, mode, ask_with, tools)
                )
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
