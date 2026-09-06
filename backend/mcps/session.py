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

USAGE = (
    "How much of the user's Claude plan is spent: percentage per limit window and when each one"
    " resets. Call it when they ask about their usage or how much they have left; the chat also"
    " shows the bars, so answer briefly on top of them."
)


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
