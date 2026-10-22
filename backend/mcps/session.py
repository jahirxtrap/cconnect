import asyncio
import time
import unicodedata

from claude_agent_sdk import tool

from mcps.components import CAPABILITY as COMPONENTS

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

INFO = (
    "What this very conversation is running on: its session id, working directory and project,"
    " plus the model, effort, account and permission mode in use. Call it when the user asks"
    " about the session itself, or when you need its id to read or act on this transcript."
)

HISTORY_DEFAULT = 20
HISTORY_MAX = 100
HISTORY_CHARS = 2000

HISTORY = (
    "What was said earlier in this very conversation, before any compaction too: the user's"
    " messages, your replies and each compaction summary, numbered in order, without the tool"
    " calls. Call it when you need something from earlier that is no longer in your context,"
    " instead of reading the transcript file. With query it lists the messages holding all its"
    " words, ignoring case and accents; with around it reads next to one of those numbers; with"
    " neither, the latest."
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
                f"Messages to return. {HISTORY_DEFAULT} by default, at most {HISTORY_MAX}; with 1 the"
                f" message comes whole instead of cut at {HISTORY_CHARS} characters."
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


def _history_window(rows: list[dict], args: dict) -> tuple[list[int], str]:
    asked = args.get("limit")
    limit = max(1, min(asked if isinstance(asked, int) else HISTORY_DEFAULT, HISTORY_MAX))
    role = args.get("role")
    words = _folded(args.get("query") or "").split()
    picked = [
        index
        for index, row in enumerate(rows)
        if (not role or row["role"] == role) and all(word in _folded(row["text"]) for word in words)
    ]
    around = args.get("around")
    if isinstance(around, int):
        start = max(0, min(around - 1 - limit // 2, len(rows) - limit))
        return [index for index in picked if start <= index < start + limit], ""
    shown = picked[-limit:]
    lead = f"{len(picked)} messages match, showing the last {len(shown)}." if words and shown else ""
    return shown, lead


def _history_text(rows: list[dict], shown: list[int], lead: str, whole: bool) -> str:
    blocks = [lead] if lead else []
    for index in shown:
        row = rows[index]
        stamp = time.strftime("%d/%m %H:%M", time.localtime(row["ts"] / 1000)) if row["ts"] else ""
        text = row["text"] if whole or len(row["text"]) <= HISTORY_CHARS else row["text"][:HISTORY_CHARS] + "…"
        blocks.append(f"#{index + 1} {row['role']} {stamp}\n{text}")
    return "\n\n".join(blocks) or "No messages match."


def make_tools(context: dict) -> list:
    from services import accounts

    tools = []
    request_compact = context.get("request_compact")
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
            shown, lead = _history_window(rows, args)
            return {"content": [{"type": "text", "text": _history_text(rows, shown, lead, args.get("limit") == 1)}]}

        tools.append(history)

    if request_compact is not None:
        @tool("compact", COMPACT, COMPACT_SCHEMA)
        async def compact(args):
            request_compact(" ".join((args.get("instructions") or "").split()))
            return {"content": [{"type": "text", "text": "Compaction will start when this turn ends."}]}

        tools.append(compact)

    if on_provider:
        return tools

    @tool("usage", USAGE, {})
    async def usage(args):
        from services.usage import usage_blocks, usage_data, window_label

        data = await usage_data(account)
        if "error" in data:
            return {"content": [{"type": "text", "text": data["error"]}]}
        windows = data.get("windows") or []
        if emit is not None and COMPONENTS in capabilities and windows:
            await emit({"type": "component", "blocks": await usage_blocks(account)})
        lines = [f"Plan: {data['plan']}"] if data.get("plan") else []
        lines += [
            f"{window_label(win['id'])}: {round(win['percent'])}%" + (" (not used yet)" if win["unused"] else "")
            for win in windows
        ]
        return {"content": [{"type": "text", "text": "\n".join(lines) or "No usage data available."}]}

    tools.append(usage)
    return tools
