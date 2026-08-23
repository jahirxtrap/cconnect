import json

from claude_agent_sdk import tool

CAPABILITY = "components"
RICH_MEDIA = "media.rich"

PREVIEW_BASIC = "embeds a gallery of images inside the form, shown small."
PREVIEW_RICH = (
    "embeds a cconnect media block inside the form, shown small: gallery (images and video),"
    " playlist, pdf or html."
)

DESCRIPTION = """Show an interactive form in the chat and wait for the user to answer it.

Use it when a decision has several options, needs more than one field at once, or reads better as a
form than as prose. For a single yes/no or a quick question, just ask in text.

Elements, in the order you list them:
- text: a markdown paragraph to explain. No id.
- select: options with label, and optional description and preview. Set multiple for checkboxes.
- input: a text field. Set multiline for a text area, lines for a fixed-height one, secret to
  mask what is typed behind a reveal toggle, value to prefill it.
- toggle: an on/off switch.
- notes: an optional free comment, folded behind a link until the user opens it. It comes back
  under "notes" rather than "values": treat it as an extra instruction from the user, not as a
  field of the form.
- buttons: a row of actions, each with an optional icon. It is terminal: picking one submits the
  whole form.
- preview: {PREVIEW}
- page: puts its own blocks on a tab. With several pages the user moves between them and answers
  everything before sending once.
- bar: read-only progress bar for a 0-100 value, with its label and an optional line under it.
  It turns into the alert colour past alert_above or under alert_below.

Every element that carries a value needs an id unique within the form; the answer comes back keyed
by those ids, with any notes split into their own "notes" map. Reuse the same block_id to replace a form you already sent instead of stacking a new
one. Never describe styling: the app owns the look."""

SHOW_DESCRIPTION = """Draw a block in the chat: bars, text and media laid out together. It asks nothing
and returns right away, so keep talking after calling it.

Use it to show a state worth seeing rather than describing: progress, a comparison, a small report.
For plain prose or a single image, write markdown instead.

Elements, in the order you list them:
- text: a markdown paragraph.
- bar: read-only progress bar for a 0-100 value, with its label and an optional line under it.
  It turns into the alert colour past alert_above or under alert_below.
- preview: {PREVIEW}
- page: puts its own blocks on a tab, so the user moves between them.

Reuse the same block_id to replace a block you already drew instead of stacking a new one.
Never describe styling: the app owns the look."""

ICONS = [
    "question", "message-square", "check", "x", "plus", "pencil", "trash", "download",
    "external-link", "refresh", "search", "settings", "info", "alert",
    "lightbulb", "shield", "file", "folder", "clock", "sparkles",
]

OPTION = {
    "type": "object",
    "properties": {
        "value": {"type": "string", "description": "What comes back in the answer."},
        "label": {"type": "string", "description": "What the user reads."},
        "description": {"type": "string", "description": "Secondary line under the label."},
        "preview": {"type": "string", "description": "Markdown shown when this option is picked."},
        "style": {"type": "string", "enum": ["primary", "danger", "plain"], "description": "Buttons only."},
        "icon": {"type": "string", "enum": ICONS, "description": "Buttons only."},
    },
    "required": ["value", "label"],
}

DISMISS = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "description": "What the user reads."},
        "icon": {"type": "string", "enum": ICONS},
    },
    "required": ["label"],
}

TYPES = ["text", "select", "input", "toggle", "notes", "buttons", "preview", "page", "bar"]

COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"]

LEAF = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": TYPES},
        "id": {"type": "string", "description": "Required for every element that carries a value."},
        "label": {"type": "string"},
        "value": {"description": "Prefilled value: string for input, boolean for toggle, 0-100 for bar."},
        "text": {"type": "string", "description": "bar: the line under it."},
        "color": {"type": "string", "enum": COLORS, "description": "bar: its colour. Accent by default."},
        "alert_above": {"type": "number", "description": "bar: alert colour from this value up."},
        "alert_below": {"type": "number", "description": "bar: alert colour from this value down."},
        "placeholder": {"type": "string"},
        "multiline": {"type": "boolean"},
        "lines": {"type": "integer", "description": "input: fixed height in lines. Implies multiline."},
        "secret": {"type": "boolean", "description": "input: mask the text behind a reveal toggle."},
        "multiple": {"type": "boolean", "description": "select: checkboxes instead of radio."},
        "required": {"type": "boolean"},
        "options": {"type": "array", "items": OPTION},
        "block": {"type": "object", "description": "preview: the cconnect block payload."},
    },
    "required": ["type"],
}

ELEMENT = {
    "type": "object",
    "properties": {
        **LEAF["properties"],
        "blocks": {"type": "array", "items": LEAF, "description": "page: the elements it holds."},
    },
    "required": ["type"],
}

SHOW_SCHEMA = {
    "type": "object",
    "properties": {
        "blocks": {"type": "array", "items": ELEMENT, "description": "The elements, in order."},
        "title": {"type": "string", "description": "Heading of the block. Without it there is no heading at all."},
        "icon": {"type": "string", "enum": ICONS, "description": "Icon next to the title."},
        "block_id": {"type": "string", "description": "Reuse it to replace an earlier block instead of stacking."},
    },
    "required": ["blocks"],
}

SCHEMA = {
    "type": "object",
    "properties": {
        "blocks": {"type": "array", "items": ELEMENT, "description": "The elements, in order."},
        "title": {"type": "string", "description": "Heading of the form. Without it there is no heading at all."},
        "icon": {"type": "string", "enum": ICONS, "description": "Icon next to the title. A question mark by default."},
        "submit": {"type": "string", "description": "Label of the send button. Ignored if a buttons element is present."},
        "dismiss": {
            **DISMISS,
            "description": "Way out of the form without answering, as a button under the others."
            " Without it the form shows a plain close icon instead.",
        },
        "block_id": {"type": "string", "description": "Reuse it to replace an earlier form instead of stacking."},
    },
    "required": ["blocks"],
}


def _note_ids(blocks: list) -> set[str]:
    ids: set[str] = set()
    for block in blocks:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "page":
            ids |= _note_ids(block.get("blocks") or [])
        elif block.get("type") == "notes" and block.get("id"):
            ids.add(block["id"])
    return ids


def make_tools(context: dict) -> list:
    ask_user = context.get("ask_user")
    emit = context.get("emit")
    capabilities = context.get("capabilities") or ()
    if CAPABILITY not in capabilities:
        return []
    description = DESCRIPTION.replace(
        "{PREVIEW}", PREVIEW_RICH if RICH_MEDIA in capabilities else PREVIEW_BASIC
    )
    tools = []

    if emit is not None:
        @tool("show_component", SHOW_DESCRIPTION.replace("{PREVIEW}", PREVIEW_RICH if RICH_MEDIA in capabilities else PREVIEW_BASIC), SHOW_SCHEMA)
        async def show(args):
            await emit({
                "type": "component",
                "block_id": args.get("block_id"),
                "title": args.get("title"),
                "icon": args.get("icon"),
                "blocks": args.get("blocks") or [],
            })
            return {"content": [{"type": "text", "text": "Shown in the chat."}]}

        tools.append(show)

    if ask_user is None:
        return tools

    @tool("ask_component", description, SCHEMA)
    async def ui(args):
        response = await ask_user({
            "kind": "component",
            "block_id": args.get("block_id"),
            "title": args.get("title"),
            "icon": args.get("icon"),
            "submit": args.get("submit"),
            "dismiss": args.get("dismiss"),
            "blocks": args.get("blocks") or [],
        })
        if response.get("chat"):
            answer = {"submitted": False, "dismissed": True}
        else:
            values = response.get("values") or {}
            note_ids = _note_ids(args.get("blocks") or [])
            answer = {"submitted": True, "values": {k: v for k, v in values.items() if k not in note_ids}}
            notes = {k: v for k, v in values.items() if k in note_ids and v}
            if notes:
                answer["notes"] = notes
        return {"content": [{"type": "text", "text": json.dumps(answer, ensure_ascii=False)}]}

    tools.append(ui)
    return tools
