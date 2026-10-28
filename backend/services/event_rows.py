"""Chat events folded into the rows a conversation's history is read back from."""

STAMPS = ("seq", "channel", "replay", "parent")
VERBATIM = ("file_change", "shared", "compact", "notice", "api_error", "interrupted", "stop")
FILTERED = ("tool_use", "thinking", "file_change")
HISTORY_PAGE = 100


def _bare(event: dict) -> dict:
    return {key: value for key, value in event.items() if key not in STAMPS}


def _append_text(rows: list[dict], kind: str, role: str, text: str) -> None:
    last = rows[-1] if rows else None
    if last is not None and last["type"] == kind and last.get("role", "") == role and "text" in last and not last.get("label"):
        last["text"] += text
    else:
        rows.append({"type": kind, "role": role, "text": text} if role else {"type": kind, "text": text})


def rows_of(events: list[dict]) -> list[dict]:
    rows: list[dict] = []
    tools: dict[str, dict] = {}
    asked: dict[str, dict] = {}
    for event in events:
        kind = event.get("type")
        if kind == "user_text":
            _append_text(rows, "text", "user", event.get("text") or "")
        elif kind == "assistant_text":
            _append_text(rows, "text", "assistant", event.get("text") or "")
        elif kind == "thinking" and event.get("label"):
            rows.append({"type": "thinking", "label": True})
        elif kind == "thinking":
            _append_text(rows, "thinking", "", event.get("text") or "")
        elif kind == "tool_use":
            row = {"type": "tool_use", "name": event.get("name"), "mcp": bool(event.get("mcp")), "text": event.get("input") or "", "id": event.get("id")}
            tools[str(event.get("id"))] = row
            rows.append(row)
        elif kind == "tool_result" and event.get("content"):
            row = tools.get(str(event.get("tool_use_id")))
            if row is not None:
                row["result"] = event["content"]
        elif kind == "interaction_request" and event.get("kind") == "permission":
            row = {"type": "interaction", "kind": "permission", "tool_name": event.get("tool_name"), "input": event.get("input") or "", "resolved": None}
            asked[str(event.get("id"))] = row
            rows.append(row)
        elif kind == "interaction_resolved":
            row = asked.get(str(event.get("id")))
            if row is not None:
                row["resolved"] = event.get("option_id")
        elif kind in VERBATIM:
            rows.append(_bare(event))
    for row in rows:
        if row["type"] in ("text", "thinking") and "text" in row:
            row["text"] = row["text"].strip()
    return [
        row for row in rows
        if (row["type"] not in ("text", "thinking") or row.get("label") or row["text"])
        and (row["type"] != "interaction" or row["resolved"])
    ]


def page_start(messages: list[dict], end: int, limit: int) -> int:
    """Where a page of ``limit`` top-level messages ending at ``end`` starts."""
    seen = 0
    for index in range(end - 1, -1, -1):
        if messages[index].get("parent"):
            continue
        seen += 1
        if seen == limit:
            return index
    return 0


def visible_rows(rows: list[dict], vis: dict, parent: str | None = None) -> list[dict]:
    """The rows as a client with these visibility settings reads them."""
    out: list[dict] = []
    for row in rows:
        kind = row.get("type")
        mode = vis.get(kind, "full") if kind in FILTERED else "full"
        if mode == "off":
            continue
        if mode == "label":
            row = {"type": "thinking", "label": True} if kind == "thinking" else {
                **{key: value for key, value in row.items() if key not in ("result", "diff_lines")},
                **({"label": True} if kind == "file_change" else {}),
            }
        out.append({**row, "parent": parent} if parent else row)
    return out
