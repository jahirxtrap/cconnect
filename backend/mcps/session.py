import asyncio
import re
import time
import unicodedata

from claude_agent_sdk import tool

from mcps.components import CAPABILITY as COMPONENTS
from services.live_sessions import RELOAD_COUNTS

COMPACT = (
    "Compact this conversation: condense the history into a summary so the context window frees up."
    " Compaction starts as soon as the current turn ends, so call it and keep going — there is"
    " nothing to wait for. Use it when the user asks you to compact, and only then. Whatever else"
    " they asked for along with it goes in `instructions`."
)

COMPACT_SCHEMA = {
    "type": "object",
    "properties": {
        "instructions": {
            "type": "string",
            "description": "What the user asked for along with the compaction, in their own words.",
        },
    },
}

RELOAD = (
    "Reload the plugins or the skills of this session right away, so the ones created, installed or edited"
    " during it can be used from this same turn; the user sees it in the chat. Use it after changing a"
    " plugin or a skill in this session, or when the user asks you to reload."
)

RELOAD_SCHEMA = {
    "type": "object",
    "properties": {
        "kind": {
            "type": "string",
            "enum": ["plugins", "skills"],
            "description": "plugins brings their commands, agents and MCP servers too; skills only the skills.",
        },
    },
    "required": ["kind"],
}

INFO = (
    "What this very conversation is running on: its session id, working directory and project,"
    " plus the model, effort, account and permission mode in use. Call it when the user asks"
    " about the session itself, or when you need its id to read or act on this transcript."
)

HISTORY_MATCHES = 10
HISTORY_NEIGHBOURS = 5
HISTORY_LATEST = 10
HISTORY_MAX = 100
HISTORY_CHARS = 2000
HISTORY_EXCERPT = 280

HISTORY = (
    "Earlier messages of this very conversation, before any compaction too: the user's, yours and"
    " each compaction summary, numbered in order, without the tool calls. Use it only when you truly"
    " don't remember something and it is no longer in your context, never to re-read what you can"
    " still see, and instead of reading the transcript file. Search first with query (all its words,"
    " ignoring case and accents): each match comes as a short excerpt with its number and length."
    " Then read only the message you need whole with around set to its number and limit 1, or its"
    " neighbours with around alone."
)

HISTORY_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string", "description": "Words a message must hold, all of them."},
        "role": {
            "type": "string",
            "enum": ["user", "assistant", "summary"],
            "description": "Only the user's messages, your replies or the compaction summaries.",
        },
        "around": {"type": "integer", "description": "A message number from an earlier call. Reads the ones next to it."},
        "limit": {
            "type": "integer",
            "description": (
                f"How many to return: {HISTORY_MATCHES} matches with query, {HISTORY_NEIGHBOURS} with around,"
                f" {HISTORY_LATEST} otherwise, at most {HISTORY_MAX}. With 1 the message comes whole instead"
                f" of as an excerpt or cut at {HISTORY_CHARS} characters."
            ),
        },
        "session": {
            "type": "string",
            "description": "Another chat of this project, by its session id. This conversation when left out.",
        },
    },
}

USAGE = (
    "How much of the user's Claude plan is spent: percentage per limit window and when each one"
    " resets. Call it when they ask about their usage or how much they have left; the chat also"
    " shows the bars, so answer briefly on top of them."
)


def _folded(text: str) -> str:
    return "".join(char for char in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(char))


def _folded_map(text: str) -> tuple[str, list[int]]:
    folded: list[str] = []
    origin: list[int] = []
    for at, char in enumerate(text):
        piece = _folded(char)
        folded.append(piece)
        origin.extend([at] * len(piece))
    return "".join(folded), origin


def _excerpt(text: str, words: list[str]) -> str:
    flat = " ".join(text.split())
    if len(flat) <= HISTORY_EXCERPT:
        return flat
    folded, origin = _folded_map(flat)
    hits = [[origin[found.start()] for found in re.finditer(re.escape(word), folded)] for word in words]
    reach = HISTORY_EXCERPT // 2
    spots = [spot for found in hits for spot in found] or [0]
    centre = max(spots, key=lambda at: (sum(any(abs(spot - at) <= reach for spot in found) for found in hits), -at))
    start = max(0, min(centre - HISTORY_EXCERPT // 3, len(flat) - HISTORY_EXCERPT))
    end = start + HISTORY_EXCERPT
    if start:
        start = flat.find(" ", start, centre) + 1 or start
    if end < len(flat) and flat.rfind(" ", centre, end) > centre:
        end = flat.rfind(" ", centre, end)
    return f"{'…' if start else ''}{flat[start:end]}{'…' if end < len(flat) else ''}"


def _history_window(rows: list[dict], args: dict) -> tuple[list[int], str, list[str]]:
    words = _folded(args.get("query") or "").split()
    around = args.get("around")
    near = isinstance(around, int)
    asked = args.get("limit")
    default = HISTORY_NEIGHBOURS if near else HISTORY_MATCHES if words else HISTORY_LATEST
    limit = max(1, min(asked if isinstance(asked, int) else default, HISTORY_MAX))
    role = args.get("role")
    picked = [
        index
        for index, row in enumerate(rows)
        if (not role or row["role"] == role) and all(word in _folded(row["text"]) for word in words)
    ]
    if near:
        start = max(0, min(around - 1 - limit // 2, len(rows) - limit))
        return [index for index in picked if start <= index < start + limit], "", []
    shown = picked[-limit:]
    if not words or not shown or limit == 1:
        return shown, "", []
    lead = (
        f"{len(picked)} messages match, showing the last {len(shown)} as excerpts."
        " Read one whole with around set to its number and limit 1."
    )
    return shown, lead, words


def _history_text(rows: list[dict], shown: list[int], lead: str, whole: bool, words: list[str]) -> str:
    blocks = [lead] if lead else []
    for index in shown:
        row = rows[index]
        stamp = time.strftime("%d/%m %H:%M", time.localtime(row["ts"] / 1000)) if row["ts"] else ""
        text = row["text"]
        if whole:
            body = text
        elif words:
            body = _excerpt(text, words)
        elif len(text) > HISTORY_CHARS:
            body = f"{text[:HISTORY_CHARS]}… (+{len(text) - HISTORY_CHARS} chars)"
        else:
            body = text
        blocks.append(f"#{index + 1} {row['role']} {stamp} · {len(text)} chars\n{body}")
    return "\n\n".join(blocks) or "No messages match."


def make_tools(context: dict) -> list:
    from services import accounts

    tools = []
    request_compact = context.get("request_compact")
    reload_session = context.get("reload")
    emit = context.get("emit")
    account = context.get("account")
    info = context.get("session_info")
    capabilities = context.get("capabilities") or ()
    on_provider = bool(accounts.provider_for(account))

    if info is not None:
        @tool("session_info", INFO, {})
        async def session_info(args):
            from services.sessions import project_key_for

            current = info() or {}
            cwd = current.get("cwd")
            lines = [f"{key}: {value}" for key, value in current.items() if value]
            if cwd:
                lines.append(f"project: {project_key_for(cwd)}")
            return {"content": [{"type": "text", "text": "\n".join(lines) or "No session yet."}]}

        tools.append(session_info)

        @tool("history", HISTORY, HISTORY_SCHEMA)
        async def history(args):
            from services.sessions import conversation

            current = info() or {}
            session = args.get("session") or current.get("session_id")
            if not session or not current.get("cwd"):
                return {"content": [{"type": "text", "text": "No conversation yet."}]}
            rows = await asyncio.to_thread(conversation, current["cwd"], session)
            if not rows:
                return {"content": [{"type": "text", "text": "No transcript for that session."}]}
            shown, lead, words = _history_window(rows, args)
            text = _history_text(rows, shown, lead, args.get("limit") == 1, words)
            return {"content": [{"type": "text", "text": text}]}

        tools.append(history)

    if request_compact is not None:
        @tool("compact", COMPACT, COMPACT_SCHEMA)
        async def compact(args):
            request_compact(" ".join((args.get("instructions") or "").split()))
            return {"content": [{"type": "text", "text": "Compaction will start when this turn ends."}]}

        tools.append(compact)

    if reload_session is not None:
        @tool("reload", RELOAD, RELOAD_SCHEMA)
        async def reload(args):
            kind = args.get("kind")
            if kind not in RELOAD_SCHEMA["properties"]["kind"]["enum"]:
                return {"content": [{"type": "text", "text": "kind is plugins or skills."}]}
            report = await reload_session(kind)
            if not report or not report.get("resident") or report.get("failed"):
                return {"content": [{"type": "text", "text": f"The {kind} could not be reloaded."}]}
            counts = ", ".join(f"{report[name]} {name.replace('_', ' ')}" for name in RELOAD_COUNTS if name in report)
            errors = f" with {report['errors']} errors" if report.get("errors") else ""
            loaded = f": {counts}" if counts else ""
            return {"content": [{"type": "text", "text": f"Reloaded the {kind}{errors}{loaded}."}]}

        tools.append(reload)

    if on_provider:
        return tools

    @tool("usage", USAGE, {})
    async def usage(args):
        from services.usage import CAPABILITY as USAGE, usage_blocks, usage_data, window_label

        data = await usage_data(account)
        if "error" in data:
            return {"content": [{"type": "text", "text": data["error"]}]}
        windows = data.get("windows") or []
        if emit is not None and USAGE in capabilities and windows:
            await emit({"type": "usage", **data})
        elif emit is not None and COMPONENTS in capabilities and windows:
            await emit({"type": "component", "blocks": await usage_blocks(account)})
        lines = [f"Plan: {data['plan']}"] if data.get("plan") else []
        lines += [
            f"{window_label(win['id'])}: {round(win['percent'])}%" + (" (not used yet)" if win["unused"] else "")
            for win in windows
        ]
        return {"content": [{"type": "text", "text": "\n".join(lines) or "No usage data available."}]}

    tools.append(usage)
    return tools
