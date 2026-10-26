"""Claude Code mods in a chat: the events their messages become, and the surface CConnect attaches to draw them."""

import json
import re
import uuid
from typing import Any, Awaitable, Callable, Optional

from loguru import logger

from services import cli_info, settings_store

SURFACE = "desktop"
CLIENT_ID = "cconnect"
CONTROL_TIMEOUT = 15.0
ANSWER_TIMEOUT = 4.0
STATE_EVENTS = frozenset({"mod_surface", "mod_panes", "mod_status", "mod_commands"})
LIVE_EVENTS = frozenset({"mod_toast", "mod_invalidate", "mod_focus", "mod_scroll"})
ROSTER_ACTIONS = frozenset({"close", "show", "focus"})
_SUBTYPES = frozenset(
    {"ui_log", "ui_status", "ui_toast", "ui_panes", "ui_invalidate", "ui_focus", "ui_scroll", "informational", "commands_changed"}
)
_ATTACH_COLUMNS = 80
_ATTACH_ROWS = 40
_SOURCE = re.compile(r"^([\w.@-]+(?:\+[\w.@-]+)*): (.+)$", re.DOTALL)
_CLIENT_SITE = ("plugin", "component", "instance_id", "client", "module")
_ACTIONS: dict[str, tuple[str, tuple[str, ...], dict[str, str]]] = {
    "press": ("ui_press", ("plugin", "handle", "key", "href"), {"surface": SURFACE, "client_id": CLIENT_ID}),
    "input": ("ui_input", ("plugin", "handle", "key", "kind", "value"), {}),
    "select": ("ui_select", ("plugin", "handle", "key", "value"), {"surface": SURFACE, "client_id": CLIENT_ID}),
    "close": ("ui_close", ("id",), {"client_id": CLIENT_ID}),
    "show": ("ui_pane_show", ("id",), {"client_id": CLIENT_ID}),
    "focus": ("ui_pane_focus", ("id",), {"client_id": CLIENT_ID}),
    "site_focus": (
        "ui_focus",
        ("component", "instance_id", "is_held", "element", "by"),
        {"surface": SURFACE, "client_id": CLIENT_ID},
    ),
    "site_scroll": (
        "ui_scroll",
        ("component", "instance_id", "offset", "by", "body_rows", "content_rows", "keyed"),
        {"surface": SURFACE, "client_id": CLIENT_ID},
    ),
    "client_press": ("ui_client_press", (*_CLIENT_SITE, "element", "event"), {}),
    "client_message": ("ui_message", (*_CLIENT_SITE, "data"), {}),
    "client_fault": ("ui_client_fault", (*_CLIENT_SITE, "phase", "reason"), {}),
    "prompt_edit": ("ui_prompt_edit", ("text", "cursor", "by"), {"surface": SURFACE, "client_id": CLIENT_ID}),
    "prompt_autocomplete": ("ui_prompt_autocomplete", ("text", "cursor"), {"surface": SURFACE, "client_id": CLIENT_ID}),
}
_FRAMED = frozenset({"Pane", "AbovePrompt"})
_HOT_RELOAD_SOURCE = "mod_hot_reload"
_HOT_RELOAD_CHOICES = {"explain": "How does this work?", "enable": "Turn them on", "decline": "Not now"}
_HOT_RELOAD_SHOWN = ("enable", "decline", "explain")
_HOT_RELOAD_MORE = "A mod is a small program"
_HOT_RELOAD_NOW = "load now"
_KEYED_MAX = 512
_ANSWERS: dict[str, tuple[str, tuple[str, ...], dict]] = {
    "ui_prompt_fill": ("prompt_fill", ("text", "mode"), {"filled": False}),
    "ui_prompt_suggest": ("prompt_suggest", ("text",), {"shown": False}),
    "ui_prompt_read": ("prompt_read", (), {"text": "", "cursor": 0}),
    "ui_copy": ("copy", ("text", "plugin"), {"copied": False}),
    "ui_read_selection": ("selection", (), {}),
}
Answerer = Callable[[str, dict], Awaitable[Optional[dict]]]


def enabled() -> bool:
    return bool(settings_store.get("mod_surfaces"))


def hot_reload(tool_input: Any) -> bool:
    """Whether an AskUserQuestion is the CLI asking to load the mods Claude writes in this session."""
    metadata = tool_input.get("metadata") if isinstance(tool_input, dict) else None
    return isinstance(metadata, dict) and metadata.get("source") == _HOT_RELOAD_SOURCE


def hot_reload_ask(question: dict) -> dict:
    text = str(question.get("question") or "")
    variant = "more" if _HOT_RELOAD_MORE in text else "now" if _HOT_RELOAD_NOW in text else "turn"
    return {"kind": "mods", "variant": variant, "options": [{"id": choice} for choice in _HOT_RELOAD_SHOWN]}


def hot_reload_answer(tool_input: dict, questions: list[dict], option_id: Optional[str]) -> dict:
    """The AskUserQuestion answer that carries the person's choice back, by the label the CLI offered."""
    question = questions[0] if questions else {}
    labels = [str(option.get("label") or "") for option in question.get("options") or [] if isinstance(option, dict)]
    choice = option_id if option_id in _HOT_RELOAD_CHOICES else "decline"
    wanted = _HOT_RELOAD_CHOICES[choice]
    label = wanted if wanted in labels or not labels else labels[list(_HOT_RELOAD_CHOICES).index(choice) % len(labels)]
    return {**tool_input, "questions": questions, "answers": {str(question.get("question") or ""): label}}


def handles(message: Any) -> bool:
    return type(message).__name__ == "SystemMessage" and getattr(message, "subtype", None) in _SUBTYPES


def notice(text: Any, name: Optional[str] = None, level: Optional[str] = None, uuid: Optional[str] = None) -> dict:
    return {"type": "notice", "text": str(text or "").strip(), "name": name, "level": level, "uuid": uuid}


def kept_notice(content: Any, level: Optional[str], uuid: Optional[str]) -> dict:
    """A line the CLI keeps in the transcript, its "<plugins>: " lead read as the name."""
    match = _SOURCE.match(str(content or "").strip())
    return notice(match.group(2), match.group(1), level, uuid) if match else notice(content, level=level, uuid=uuid)


def roster(data: dict) -> dict:
    panes = [
        {
            "id": pane["id"],
            "title": pane.get("title") or pane["id"],
            "plugin": pane.get("plugin"),
            "close_on_escape": bool(pane.get("close_on_escape")),
            "columns": pane.get("columns") if isinstance(pane.get("columns"), int) else None,
        }
        for pane in data.get("panes") or []
        if isinstance(pane, dict) and pane.get("id")
    ]
    return {
        "type": "mod_panes",
        "panes": panes,
        "shown_id": data.get("shown_id"),
        "focused_id": data.get("focused_id"),
        "focus_requested_id": data.get("focus_requested_id"),
    }


def commands(listed: Any) -> dict:
    """The slash commands the session's mods registered, as the Mods pane offers them."""
    return {
        "type": "mod_commands",
        "commands": [
            {
                "name": entry["name"],
                "description": str(entry.get("description") or ""),
                "argument_hint": str(entry.get("argumentHint") or ""),
                "plugin": entry["plugin"],
            }
            for entry in listed or []
            if isinstance(entry, dict) and entry.get("name") and entry.get("plugin")
        ],
    }


def _invalidated(raw: Any) -> Optional[list[dict]]:
    if not isinstance(raw, list):
        return None
    return [
        {"component": item["component"], "instance_id": item["instance_id"]}
        for item in raw
        if isinstance(item, dict) and item.get("component") and item.get("instance_id") and item.get("surface", SURFACE) == SURFACE
    ]


def events(subtype: Optional[str], data: Any) -> list[dict]:
    """What a CLI system message shows; with mods off, only the lines the transcript keeps."""
    if not isinstance(data, dict):
        return []
    if subtype == "informational":
        return [kept_notice(data.get("content"), data.get("level"), data.get("uuid"))]
    if subtype == "commands_changed":
        listed = {"type": "commands", "commands": cli_info.commands({"commands": data.get("commands")})}
        return [listed, commands(data.get("commands"))] if enabled() else [listed]
    if not enabled():
        return []
    if subtype == "ui_log":
        return [notice(data.get("text"), data.get("plugin"))]
    if subtype == "ui_status":
        return [{"type": "mod_status", "plugin": data.get("plugin"), "text": data.get("text")}]
    if subtype == "ui_toast":
        return [{"type": "mod_toast", "plugin": data.get("plugin"), "text": data.get("text"), "timeout_ms": data.get("timeout_ms")}]
    if subtype == "ui_panes":
        return [roster(data)]
    if subtype == "ui_invalidate":
        return [{"type": "mod_invalidate", "instances": _invalidated(data.get("instances"))}]
    if subtype == "ui_focus":
        return [{
            "type": "mod_focus",
            "component": data.get("component"),
            "instance_id": data.get("instance_id"),
            "plugin": data.get("plugin"),
            "key": data.get("key"),
        }]
    if subtype == "ui_scroll":
        return [{
            "type": "mod_scroll",
            "component": data.get("component"),
            "instance_id": data.get("instance_id"),
            "offset": data.get("offset"),
            "follow_end": bool(data.get("follow_end")),
        }]
    return []


class Surface:
    """What a chat's mods have open and say, as every attached client draws it."""

    def __init__(self):
        self.attached = False
        self.panes: list[dict] = []
        self.shown_id: Optional[str] = None
        self.focused_id: Optional[str] = None
        self.focus_requested_id: Optional[str] = None
        self.status: dict[str, str] = {}
        self.commands: list[dict] = []

    def apply(self, event: dict) -> None:
        kind = event.get("type")
        if kind == "mod_surface":
            self.attached = bool(event.get("attached"))
            if not self.attached:
                self.panes, self.shown_id, self.focused_id, self.focus_requested_id = [], None, None, None
                self.status, self.commands = {}, []
        elif kind == "mod_commands":
            self.commands = event.get("commands") or []
        elif kind == "mod_panes":
            self.panes = event.get("panes") or []
            self.shown_id = event.get("shown_id")
            self.focused_id = event.get("focused_id")
            self.focus_requested_id = event.get("focus_requested_id")
        elif kind == "mod_status":
            plugin = event.get("plugin") or ""
            if event.get("text"):
                self.status[plugin] = event["text"]
            else:
                self.status.pop(plugin, None)

    def drop(self, plugins: set[str]) -> bool:
        """Forget what the given plugins left on screen; whether anything went."""
        panes = [pane for pane in self.panes if pane.get("plugin") not in plugins]
        commands = [command for command in self.commands if command.get("plugin") not in plugins]
        status = {plugin: text for plugin, text in self.status.items() if plugin not in plugins}
        if (panes, commands, status) == (self.panes, self.commands, self.status):
            return False
        kept = {pane.get("id") for pane in panes}
        self.panes, self.commands, self.status = panes, commands, status
        self.shown_id, self.focused_id, self.focus_requested_id = (
            pane_id if pane_id in kept else None
            for pane_id in (self.shown_id, self.focused_id, self.focus_requested_id)
        )
        return True

    def snapshot(self) -> dict:
        shown = self if enabled() else Surface()
        return {
            "type": "mods",
            "surface": shown.attached,
            "panes": shown.panes,
            "shown_id": shown.shown_id,
            "focused_id": shown.focused_id,
            "focus_requested_id": shown.focus_requested_id,
            "status": [{"plugin": plugin, "text": text} for plugin, text in shown.status.items()],
            "commands": shown.commands,
        }


def request_event(subtype: str, data: dict) -> Optional[dict]:
    """The ask a client answers for the CLI, in the shape the socket carries."""
    if subtype not in _ANSWERS:
        return None
    kind, fields, _ = _ANSWERS[subtype]
    return {"type": "mod_request", "id": uuid.uuid4().hex, "kind": kind, **{field: data.get(field) for field in fields}}


def unanswered(subtype: str) -> dict:
    return dict(_ANSWERS[subtype][2])


def settled(kind: str, answer: Any) -> Optional[dict]:
    """A client's answer cut to the fields the CLI reads, or None when it settles nothing."""
    answer = answer if isinstance(answer, dict) else {}
    if kind == "prompt_fill":
        return {"filled": answer.get("filled") is True}
    if kind == "prompt_suggest":
        return {"shown": answer.get("shown") is True}
    if kind == "prompt_read":
        text = str(answer.get("text") or "")
        cursor = answer.get("cursor")
        return {"text": text, "cursor": min(max(cursor, 0), len(text)) if isinstance(cursor, int) else len(text)}
    if kind == "copy":
        return {"copied": answer.get("copied") is True}
    if kind == "selection":
        text = str(answer.get("text") or "")
        return {"text": text} if text else None
    return None


def serve(client: Any, answer: Answerer) -> None:
    """Answer the requests the CLI sends a surface for its mods, leaving every other one to the SDK."""
    query = getattr(client, "_query", None)
    if query is None:
        return
    handle = query._handle_control_request

    async def handled(request: dict) -> None:
        data = request.get("request") or {}
        subtype = data.get("subtype")
        if subtype not in _ANSWERS:
            await handle(request)
            return
        try:
            response = await answer(subtype, data) or unanswered(subtype)
        except Exception as exc:
            logger.warning(f"{subtype} unanswered: {type(exc).__name__}: {exc}")
            response = unanswered(subtype)
        reply = {"type": "control_response", "response": {"subtype": "success", "request_id": request.get("request_id"), "response": response}}
        await query.transport.write(json.dumps(reply) + "\n")

    query._handle_control_request = handled


async def request(client: Any, subtype: str, /, **payload) -> Optional[dict]:
    query = getattr(client, "_query", None)
    if query is None:
        return None
    try:
        return await query._send_control_request({"subtype": subtype, **payload}, timeout=CONTROL_TIMEOUT)
    except Exception as exc:
        logger.debug(f"{subtype} failed: {type(exc).__name__}: {exc}")
        return None


def _viewport(columns: int, rows: int) -> dict:
    """The drawing area in cells, for a surface that docks panes beside the chat."""
    return {"columns": columns, "rows": rows, "isFullscreen": True}


async def attach(client: Any) -> bool:
    answer = await request(
        client,
        "ui_attach",
        surface=SURFACE,
        client_id=CLIENT_ID,
        viewport=_viewport(_ATTACH_COLUMNS, _ATTACH_ROWS),
        answers=list(_ANSWERS),
    )
    return SURFACE in ((answer or {}).get("surfaces") or [])


async def panes(client: Any) -> Optional[dict]:
    answer = await request(client, "ui_panes", client_id=CLIENT_ID)
    return roster(answer) if isinstance(answer, dict) else None


def _props(component: str, own: dict, site: dict) -> dict:
    """The props the engine reads for a site: a frame's from what the surface holds, any other's as the page drew it."""
    if component not in _FRAMED:
        return own
    scroll = {"offset": site["offset"], "bodyRows": site["rows"]}
    if component == "AbovePrompt":
        return {
            "hasSurvey": False,
            "isWorking": site["working"],
            "maxRows": site["rows"],
            "bodyColumns": site["columns"],
            "scroll": scroll,
            "view": {},
        }
    return {
        "title": site["title"],
        "isFocused": site["focused"],
        "bodyColumns": site["columns"],
        "placement": "dock",
        "scroll": scroll,
        "view": {},
    }


async def render(client: Any, component: str, instance_id: str, own: dict, site: dict) -> dict:
    answer = await request(
        client,
        "ui_render",
        surface=SURFACE,
        client_id=CLIENT_ID,
        component=component,
        instance_id=instance_id,
        props=_props(component, own, site),
        viewport=_viewport(site["columns"], site["rows"]),
    ) or {}
    tree = answer.get("tree")
    hooked = bool(answer.get("hooked"))
    return {
        "tree": tree if hooked and isinstance(tree, dict) and tree.get("type") != "engine" else None,
        "props": answer.get("props") if answer.get("rewritten") and isinstance(answer.get("props"), dict) else None,
        "hooked": hooked,
        "client_modules": answer.get("client_modules") if isinstance(answer.get("client_modules"), dict) else {},
    }


async def render_in_chat(client: Any, component: str, instance_id: str, props: dict) -> dict:
    """A site the chat draws outside any pane, at the viewport the surface attached with."""
    return await render(client, component, instance_id, props, {"columns": _ATTACH_COLUMNS, "rows": _ATTACH_ROWS})


def drawn_questions(drawn: Optional[dict], questions: list[dict]) -> list[dict]:
    """The questions a hook rewrote for the dialog, or the asked ones when it rewrote none that still fit."""
    rewritten = ((drawn or {}).get("props") or {}).get("questions")
    if not isinstance(rewritten, list) or not rewritten:
        return questions
    valid = all(isinstance(q, dict) and isinstance(q.get("question"), str) and isinstance(q.get("options"), list) for q in rewritten)
    return rewritten if valid else questions


async def client_module(client: Any, plugin: str) -> Optional[dict]:
    """A plugin's surface modules, as a frame links them to draw its Clients."""
    return await request(client, "ui_client_module", plugin=plugin)


async def act(client: Any, action: str, fields: dict) -> Optional[dict]:
    subtype, keys, extra = _ACTIONS[action]
    payload = {key: fields[key] for key in keys if key in fields}
    if action == "press":
        payload["press_id"] = uuid.uuid4().hex
    if action == "prompt_edit" and "stroke" in fields:
        payload["key"] = fields["stroke"]
    if "keyed" in payload:
        payload["keyed"] = payload["keyed"][:_KEYED_MAX]
    return await request(client, subtype, **payload, **extra)


def redirected_focus(fields: dict, answer: Optional[dict]) -> Optional[dict]:
    """The focus push a site follows when a hook moved the ring somewhere other than where the person put it."""
    element = (answer or {}).get("element")
    if not isinstance(element, dict) or element == fields.get("element"):
        return None
    return {
        "type": "mod_focus",
        "component": fields.get("component"),
        "instance_id": fields.get("instance_id"),
        "plugin": element.get("plugin"),
        "key": element.get("key"),
    }
