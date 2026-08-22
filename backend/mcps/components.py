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
- input: a text field. Set multiline for a text area, value to prefill it.
- toggle: an on/off switch.
- notes: an optional free comment, folded behind a link until the user opens it.
- buttons: a row of actions, each with an optional icon. It is terminal: picking one submits the
  whole form.
- preview: {PREVIEW}
- page: puts its own blocks on a tab. With several pages the user moves between them and answers
  everything before sending once.

Every element that carries a value needs an id unique within the form; the answer comes back keyed
by those ids. Reuse the same block_id to replace a form you already sent instead of stacking a new
one. Never describe styling: the app owns the look."""

ICONS = [
    "message-square", "check", "x", "plus", "pencil", "trash", "download",
    "external-link", "refresh", "search", "settings", "info", "alert",
    "lightbulb", "shield", "file", "folder",
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

TYPES = ["text", "select", "input", "toggle", "notes", "buttons", "preview", "page"]

LEAF = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": TYPES},
        "id": {"type": "string", "description": "Required for every element that carries a value."},
        "label": {"type": "string"},
        "value": {"description": "Prefilled value: string for input, boolean for toggle."},
        "placeholder": {"type": "string"},
        "multiline": {"type": "boolean"},
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

SCHEMA = {
    "type": "object",
    "properties": {
        "blocks": {"type": "array", "items": ELEMENT, "description": "The elements, in order."},
        "title": {"type": "string", "description": "Heading of the form."},
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


def make_tools(context: dict) -> list:
    ask_user = context.get("ask_user")
    capabilities = context.get("capabilities") or ()
    if ask_user is None or CAPABILITY not in capabilities:
        return []
    description = DESCRIPTION.replace(
        "{PREVIEW}", PREVIEW_RICH if RICH_MEDIA in capabilities else PREVIEW_BASIC
    )

    @tool("ask_component", description, SCHEMA)
    async def ui(args):
        response = await ask_user({
            "kind": "component",
            "block_id": args.get("block_id"),
            "title": args.get("title"),
            "submit": args.get("submit"),
            "dismiss": args.get("dismiss"),
            "blocks": args.get("blocks") or [],
        })
        if response.get("chat"):
            answer = {"submitted": False, "dismissed": True}
        else:
            answer = {"submitted": True, "values": response.get("values") or {}}
        return {"content": [{"type": "text", "text": json.dumps(answer, ensure_ascii=False)}]}

    return [ui]
