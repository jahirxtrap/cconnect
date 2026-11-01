from functools import partial
from typing import Any, Awaitable, Callable, Optional

SUBTYPE = "elicitation"
ACCEPT = "accept"
DECLINE = "decline"
CANCEL = "cancel"
URL_MODE = "url"
URL_ACTION = "action"
CLOSED_BY = "close"
INTEGER = "integer"
NUMBER = "number"
BOOLEAN = "boolean"
ARRAY = "array"

Ask = Callable[[dict], Awaitable[dict]]


def cancelled() -> dict:
    return {"action": CANCEL}


def _field(name: str, spec: dict, required: bool) -> list[dict]:
    kind = spec.get("type")
    label = str(spec.get("title") or name)
    base: dict = {"id": name, "label": label, **({"required": True} if required and kind != BOOLEAN else {})}
    about = [{"type": "text", "text": str(spec["description"])}] if spec.get("description") else []
    if kind == BOOLEAN:
        return [*about, {**base, "type": "toggle", "value": bool(spec.get("default"))}]
    if kind in (NUMBER, INTEGER):
        bounds = {key: spec[key] for key in ("minimum", "maximum") if isinstance(spec.get(key), (int, float))}
        return [*about, {
            **base,
            "type": "input",
            "format": "number",
            **({"min": bounds["minimum"]} if "minimum" in bounds else {}),
            **({"max": bounds["maximum"]} if "maximum" in bounds else {}),
            **({"step": 1} if kind == INTEGER else {}),
            **({"value": str(spec["default"])} if spec.get("default") is not None else {}),
        }]
    if kind == ARRAY:
        items = spec.get("items") or {}
        return [*about, {**base, "type": "select", "multiple": True, "options": _choices(items)}]
    choices = _choices(spec)
    if choices:
        return [*about, {**base, "type": "select", "display": "dropdown", "options": choices}]
    return [*about, {
        **base,
        "type": "input",
        **{key: spec[key] for key in ("pattern",) if isinstance(spec.get(key), str)},
        **({"min_length": spec["minLength"]} if isinstance(spec.get("minLength"), int) else {}),
        **({"max_length": spec["maxLength"]} if isinstance(spec.get("maxLength"), int) else {}),
        **({"value": str(spec["default"])} if spec.get("default") is not None else {}),
    }]


def _choices(spec: dict) -> list[dict]:
    listed = spec.get("oneOf") or spec.get("anyOf")
    if isinstance(listed, list):
        return [
            {"value": str(item.get("const")), "label": str(item.get("title") or item.get("const")), **({"description": str(item["description"])} if item.get("description") else {})}
            for item in listed
            if isinstance(item, dict) and item.get("const") is not None
        ]
    values = spec.get("enum")
    if not isinstance(values, list):
        return []
    names = spec.get("enumNames")
    labels = names if isinstance(names, list) and len(names) == len(values) else values
    return [{"value": str(value), "label": str(label)} for value, label in zip(values, labels)]


def _typed(value: Any, spec: dict) -> Any:
    kind = spec.get("type")
    if kind == BOOLEAN:
        return value if isinstance(value, bool) else str(value).lower() == "true"
    if kind in (NUMBER, INTEGER):
        try:
            number = float(value)
        except (TypeError, ValueError):
            return value
        return int(number) if kind == INTEGER or number.is_integer() else number
    if kind == ARRAY:
        return [_text(item) for item in value] if isinstance(value, list) else [_text(value)]
    return _text(value)


def _text(value: Any) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def _given(value: Any) -> bool:
    return value is not None and value != "" and value != []


def _properties(request: dict) -> dict:
    properties = (request.get("requestedSchema") or {}).get("properties") or {}
    return {str(name): spec for name, spec in properties.items() if isinstance(spec, dict)}


def form(request: dict, source: Optional[str] = None) -> dict:
    message = str(request.get("message") or "")
    lead = [{"type": "text", "text": message}] if source and message else []
    title = source or message
    if request.get("mode") == URL_MODE:
        url = str(request.get("url") or "")
        return {
            "kind": "component",
            "title": title,
            "blocks": [
                *lead,
                {"type": "text", "text": f"[{url}]({url})"},
                {"type": "buttons", "id": URL_ACTION, "options": [
                    {"value": ACCEPT, "label": "", "label_key": "link_done", "style": "primary", "icon": "check"},
                    {"value": DECLINE, "label": "", "label_key": "cancel", "style": "plain", "icon": "x"},
                ]},
            ],
        }
    required = set((request.get("requestedSchema") or {}).get("required") or [])
    blocks = [element for name, spec in _properties(request).items() for element in _field(name, spec, name in required)]
    return {"kind": "component", "title": title, "blocks": [*lead, *blocks]}


def answer(response: dict, request: dict) -> dict:
    if response.get("chat"):
        return {"action": CANCEL if response.get("dismissed_by") == CLOSED_BY else DECLINE}
    values = response.get("values")
    if not isinstance(values, dict):
        return cancelled()
    if request.get("mode") == URL_MODE:
        return {"action": ACCEPT if values.get(URL_ACTION) == ACCEPT else DECLINE}
    content = {name: _typed(values[name], spec) for name, spec in _properties(request).items() if _given(values.get(name))}
    return {"action": ACCEPT, "content": content}


def from_cli(data: dict) -> dict:
    schema = data.get("requested_schema") or {}
    properties = schema.get("properties") or {}
    order = data.get("property_order")
    if isinstance(order, list):
        properties = {**{name: properties[name] for name in order if name in properties}, **properties}
    return {
        "message": data.get("message"),
        "mode": data.get("mode"),
        "url": data.get("url"),
        "elicitationId": data.get("elicitation_id"),
        "requestedSchema": {**schema, "properties": properties},
    }


async def asked(ask: Ask, data: dict) -> dict:
    request = from_cli(data)
    return answer(await ask(form(request, data.get("mcp_server_name"))), request)


def answers(ask: Optional[Ask]) -> dict[str, Callable[[dict], Awaitable[dict]]]:
    return {SUBTYPE: partial(asked, ask)} if ask is not None else {}
