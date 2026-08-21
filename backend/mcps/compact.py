"""Let the model compact its own conversation when asked to."""

from claude_agent_sdk import tool


def make_tools(context: dict) -> list:
    """The SDK has no on-demand compaction and a turn can't compact itself mid-stream,
    so the tool only flags the request and the turn compacts once it closes."""
    request = context.get("request_compact")
    if request is None:
        return []

    @tool(
        "compact",
        "Compact this conversation: condense the history into a summary so the "
        "context window frees up. Compaction starts as soon as the current turn "
        "ends, so call it and keep going — there is nothing to wait for. Use it "
        "when the user asks you to compact, and only then.",
        {},
    )
    async def compact(args):
        request()
        return {"content": [{"type": "text", "text": "Compaction will start when this turn ends."}]}

    return [compact]
