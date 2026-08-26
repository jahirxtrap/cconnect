import json
from pathlib import Path

from claude_agent_sdk import tool

from core.config import SHARED_DIR
from mcps.media import preview_description

CAPABILITY = "components"

DESCRIPTION = """Show an interactive form in the chat and wait for the user to answer it.

Use it when a decision has several options, needs more than one field at once, or reads better as a
form than as prose. For a single yes/no or a quick question, just ask in text.

Elements, in the order you list them:
- text: a markdown paragraph to explain, written in `text`.
- select: options with label, and optional description and preview. Set multiple for checkboxes,
  display "dropdown" to fold a long list into a picker.
- input: a text field. Set multiline for a text area, lines for a fixed-height one, secret to
  mask what is typed behind a reveal toggle, value to prefill it, format "number" to take a
  number instead of text.
- toggle: an on/off switch.
- slider: a number the user drags between min and max, moving by step. Its value reads next to it
  unless display is "bare", and leaving label out drops the line above it.
- color: one colour out of the app's palette. The answer is its name.
- path: a file or folder on the machine running you, picked by browsing it. Set pick to "file" or
  "dir", start to open somewhere other than the top. The answer is an absolute path that exists,
  so prefer it over asking for a path in an input.
- file: files the user picks from their own device. They are uploaded first, and the answer is
  their absolute path, ready to read.
- notes: an optional free comment, folded behind a link until the user opens it. It comes back
  under "notes" rather than "values": treat it as an extra instruction from the user, not as a
  field of the form.
- buttons: a row of actions, each with an optional icon. It is terminal: picking one submits the
  whole form. Give an action a confirm and it asks before going through.
- preview: {PREVIEW}
- page: puts its own blocks on a tab. With several pages the user moves between them and answers
  everything before sending once.
- group: folds its own blocks into a section, closed until the user opens it or you set open.
  Use it to keep rarely-touched fields out of the way, and page to split a long form into steps.
  A group can live inside a page; a page cannot live inside a group.
- bar: read-only progress bar for a 0-100 value, with its label and an optional line under it.
  It turns into the alert colour past alert_above or under alert_below. Its percentage reads on the
  right unless display is "bare", and leaving label out drops the line above it.

Every element that carries a value needs an id unique within the form; the answer comes back keyed
by those ids, with any notes split into their own "notes" map.

Ask only for what the moment needs: give an element show_if and it shows up only once another
answer matches, and a field that stayed hidden is left out of the answer entirely instead of
coming back empty.

Constrain the value instead of checking it afterwards: required, min and max, min_length,
max_length and pattern (a regular expression) hold the form back until it fits, and error is the
line the user reads while it does not.

Set present to "dialog" to ask in a dialog over the chat rather than inline; either way the answer
stays in the conversation. Reuse the same block_id to replace a form you already sent instead of
stacking a new one. Never describe styling: the app owns the look."""

SHOW_DESCRIPTION = """Draw a block in the chat: bars, text and media laid out together. It asks nothing
and returns right away, so keep talking after calling it.

Use it to show a state worth seeing rather than describing: progress, a comparison, a small report.
For plain prose or a single image, write markdown instead.

Elements, in the order you list them:
- text: a markdown paragraph, written in `text`.
- bar: read-only progress bar for a 0-100 value, with its label and an optional line under it.
  It turns into the alert colour past alert_above or under alert_below. Its percentage reads on the
  right unless display is "bare", and leaving label out drops the line above it.
- preview: {PREVIEW}
- page: puts its own blocks on a tab, so the user moves between them.
- group: folds its own blocks into a section, closed until the user opens it or you set open.

Reuse the same block_id to replace a block you already drew instead of stacking a new one.
Never describe styling: the app owns the look."""

ICONS = [
    "question", "message-square", "check", "x", "plus", "pencil", "trash", "download",
    "external-link", "refresh", "search", "settings", "info", "alert",
    "lightbulb", "shield", "file", "folder", "clock", "sparkles",
]

CONFIRM = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "Heading of the dialog."},
        "text": {"type": "string", "description": "What it asks before going through."},
        "confirm_label": {"type": "string", "description": "Label of the button that goes through."},
    },
    "required": ["text"],
}

OPTION = {
    "type": "object",
    "properties": {
        "value": {"type": "string", "description": "What comes back in the answer."},
        "label": {"type": "string", "description": "What the user reads."},
        "description": {"type": "string", "description": "Secondary line under the label."},
        "preview": {"type": "string", "description": "Markdown shown when this option is picked."},
        "style": {"type": "string", "enum": ["primary", "danger", "plain"], "description": "Buttons only."},
        "icon": {"type": "string", "enum": ICONS, "description": "Buttons only."},
        "confirm": {**CONFIRM, "description": "Buttons only. Ask before this action goes through."},
    },
    "required": ["value", "label"],
}

DISMISS = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "description": "What the user reads."},
        "icon": {"type": "string", "enum": ICONS},
        "confirm": {**CONFIRM, "description": "Ask before leaving the form."},
    },
    "required": ["label"],
}

SHOW_IF = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "description": "The element whose answer decides it."},
        "equals": {"type": "string", "description": "Show when that answer is exactly this."},
        "in": {"type": "array", "items": {"type": "string"}, "description": "Show when that answer is one of these."},
        "truthy": {
            "type": "boolean",
            "description": "true: show once that answer has any value. false: show while it has none.",
        },
    },
    "required": ["id"],
}

TYPES = [
    "text", "select", "input", "toggle", "notes", "buttons", "preview",
    "page", "group", "bar", "slider", "color", "path", "file",
]

COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"]

LEAF = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": TYPES},
        "id": {"type": "string", "description": "Required for every element that carries a value."},
        "label": {"type": "string", "description": "Heading of the element."},
        "value": {
            "description": "Prefilled value: string for input, path and file, boolean for toggle,"
            " 0-100 for bar, a number for slider, a colour name for color.",
        },
        "text": {"type": "string", "description": "text: its markdown. bar: the line under it."},
        "color": {"type": "string", "enum": COLORS, "description": "bar: its colour. Accent by default."},
        "alert_above": {"type": "number", "description": "bar: alert colour from this value up."},
        "alert_below": {"type": "number", "description": "bar: alert colour from this value down."},
        "placeholder": {"type": "string"},
        "multiline": {"type": "boolean"},
        "lines": {"type": "integer", "description": "input: fixed height in lines. Implies multiline."},
        "secret": {"type": "boolean", "description": "input: mask the text behind a reveal toggle."},
        "format": {"type": "string", "enum": ["number"], "description": "input: the kind of value it takes."},
        "display": {
            "type": "string",
            "enum": ["list", "dropdown", "bare"],
            "description": (
                "select: how the options are laid out, a list by default."
                " slider, bar: \"bare\" drops the number and leaves the control on its own."
            ),
        },
        "multiple": {"type": "boolean", "description": "select: checkboxes instead of radio. file: several files."},
        "required": {"type": "boolean"},
        "show_if": {**SHOW_IF, "description": "Show this element only while the condition holds."},
        "min": {"type": "number", "description": "slider: lowest value, required. input number: lowest accepted."},
        "max": {"type": "number", "description": "slider: highest value, required. input number: highest accepted."},
        "step": {"type": "number", "description": "slider, input number: how much the value moves at a time."},
        "min_length": {"type": "integer", "description": "input: shortest text accepted."},
        "max_length": {"type": "integer", "description": "input: longest text accepted."},
        "pattern": {"type": "string", "description": "input: regular expression the text has to match."},
        "error": {"type": "string", "description": "The line the user reads while the value does not fit."},
        "open": {"type": "boolean", "description": "group: start it open instead of closed."},
        "pick": {"type": "string", "enum": ["file", "dir"], "description": "path: what to browse for. A folder by default."},
        "start": {"type": "string", "description": "path: folder the browser opens in."},
        "accept": {"type": "string", "description": "file: extensions to offer, like \".png,.pdf\"."},
        "options": {"type": "array", "items": OPTION},
        "block": {"type": "object", "description": "preview: the cconnect block payload."},
    },
    "required": ["type"],
}

NODE = {
    "type": "object",
    "properties": {
        **LEAF["properties"],
        "blocks": {"type": "array", "items": LEAF, "description": "group: the elements it holds."},
    },
    "required": ["type"],
}

ELEMENT = {
    "type": "object",
    "properties": {
        **LEAF["properties"],
        "blocks": {"type": "array", "items": NODE, "description": "page, group: the elements they hold."},
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
            " The close icon in the corner does the same and is always there.",
        },
        "present": {
            "type": "string",
            "enum": ["inline", "dialog"],
            "description": "Where to ask. Inline in the conversation by default.",
        },
        "block_id": {"type": "string", "description": "Reuse it to replace an earlier form instead of stacking."},
    },
    "required": ["blocks"],
}


def _walk(blocks: list):
    for block in blocks or []:
        if not isinstance(block, dict):
            continue
        yield block
        yield from _walk(block.get("blocks") or [])


def _ids_of(blocks: list, kind: str) -> set[str]:
    return {block["id"] for block in _walk(blocks) if block.get("type") == kind and block.get("id")}


def _numeric_ids(blocks: list) -> set[str]:
    return {
        block["id"]
        for block in _walk(blocks)
        if block.get("id") and (block.get("type") == "slider" or block.get("format") == "number")
    }


def _absolute(value):
    items = value if isinstance(value, list) else [value]
    paths = [str(Path(SHARED_DIR) / str(item)) for item in items if item]
    if not paths:
        return value
    return paths if isinstance(value, list) else paths[0]


def _number(value):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return value
    return int(parsed) if parsed.is_integer() else parsed


def make_tools(context: dict) -> list:
    ask_user = context.get("ask_user")
    emit = context.get("emit")
    capabilities = context.get("capabilities") or ()
    if CAPABILITY not in capabilities:
        return []
    preview = preview_description(capabilities)
    tools = []

    if emit is not None:
        @tool("show_component", SHOW_DESCRIPTION.replace("{PREVIEW}", preview), SHOW_SCHEMA)
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

    @tool("ask_component", DESCRIPTION.replace("{PREVIEW}", preview), SCHEMA)
    async def ui(args):
        blocks = args.get("blocks") or []
        response = await ask_user({
            "kind": "component",
            "block_id": args.get("block_id"),
            "title": args.get("title"),
            "icon": args.get("icon"),
            "submit": args.get("submit"),
            "dismiss": args.get("dismiss"),
            "present": args.get("present"),
            "blocks": blocks,
        })
        if response.get("chat"):
            answer = {"submitted": False, "dismissed": True}
            if response.get("dismissed_by"):
                answer["dismissed_by"] = response["dismissed_by"]
        else:
            values = response.get("values") or {}
            note_ids = _ids_of(blocks, "notes")
            file_ids = _ids_of(blocks, "file")
            number_ids = _numeric_ids(blocks)
            answer = {
                "submitted": True,
                "values": {
                    key: _absolute(value) if key in file_ids
                    else _number(value) if key in number_ids
                    else value
                    for key, value in values.items()
                    if key not in note_ids
                },
            }
            notes = {key: value for key, value in values.items() if key in note_ids and value}
            if notes:
                answer["notes"] = notes
        return {"content": [{"type": "text", "text": json.dumps(answer, ensure_ascii=False)}]}

    tools.append(ui)
    return tools
