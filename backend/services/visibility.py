"""Per-connection chat visibility: what each socket asked to be sent."""

from typing import Any, Callable, Iterable

from services import settings_store

TYPES = ("thinking", "tool_use", "file_change", "compact")

_RANK = {"off": 0, "label": 1, "full": 2}

_SIMPLE = {"thinking": "off", "tool_use": "off"}

_STAMPS = ("seq", "channel", "parent")

_FILE_CHANGE_KEEP = ("type", "id", "path")


def defaults() -> dict:
    prefs = {name: settings_store.visibility_mode(name) for name in TYPES}
    prefs["simple"] = bool(settings_store.get("simple_mode"))
    return _applied(prefs)


def resolve(prefs: dict | None) -> dict:
    out = {name: settings_store.visibility_mode(name) for name in TYPES}
    out["simple"] = bool(settings_store.get("simple_mode"))
    for key, value in (prefs or {}).items():
        if key == "simple":
            if value is not None:
                out["simple"] = bool(value)
        elif key in TYPES and value in _RANK:
            out[key] = value
    return _applied(out)


def _applied(prefs: dict) -> dict:
    return {**prefs, **_SIMPLE} if prefs.get("simple") else prefs


def ceiling(everyone: Iterable[dict]) -> dict:
    """The most detail any attached socket asked for, so the turn never produces
    (nor buffers for replay) content nobody wants."""
    listed = [p for p in everyone if p]
    if not listed:
        return defaults()
    out = {name: "off" for name in TYPES}
    for prefs in listed:
        for name in TYPES:
            if _RANK[prefs.get(name, "off")] > _RANK[out[name]]:
                out[name] = prefs[name]
    out["simple"] = all(p.get("simple") for p in listed)
    return out


def new_carry() -> dict:
    return {"working": False, "thinking": False}


def shrink(event: dict, prefs: dict, carry: dict) -> dict | None:
    """Cut one event down to what this socket wants, or drop it entirely.
    In simple mode a dropped event becomes a single ``working`` marker per batch."""
    kind = event.get("type")

    if kind == "thinking":
        mode = prefs["thinking"]
        if mode == "off":
            return _working(event, prefs, carry)
        if mode == "label":
            if carry["thinking"]:
                return None
            carry["thinking"] = True
            return {"type": "thinking", "label": True, **_stamps(event)}
        carry["thinking"] = True
        return event

    if kind in ("tool_use", "tool_result", "agent"):
        mode = prefs["tool_use"]
        if mode == "off":
            return _working(event, prefs, carry)
        _reset(carry)
        if kind == "tool_result" and mode != "full":
            return {key: value for key, value in event.items() if key != "content"}
        if kind == "agent":
            return {**event, "label": mode == "label"}
        return event

    if kind == "file_change":
        mode = prefs["file_change"]
        if mode == "off":
            return _working(event, prefs, carry)
        _reset(carry)
        if mode == "label":
            kept = {key: value for key, value in event.items() if key in _FILE_CHANGE_KEEP}
            return {**kept, "label": True, **_stamps(event)}
        return event

    if kind in ("compact", "compact_summary") and prefs["compact"] == "label":
        _reset(carry)
        return {**event, "summary": ""}

    _reset(carry)
    return event


def _working(event: dict, prefs: dict, carry: dict) -> dict | None:
    if not prefs.get("simple") or carry["working"]:
        return None
    carry["working"] = True
    carry["thinking"] = False
    return {"type": "working", **_stamps(event)}


def _reset(carry: dict) -> None:
    carry["working"] = False
    carry["thinking"] = False


def _stamps(event: dict) -> dict:
    return {key: event[key] for key in _STAMPS if key in event}


def sink_for(send: Callable, holder: dict) -> Callable:
    """Wrap a socket's send with its own visibility, so filtering happens per
    connection instead of once for everyone attached to the session."""
    carry = new_carry()

    async def filtered(payload: dict) -> Any:
        out = shrink(payload, holder["prefs"], carry)
        if out is not None:
            await send(out)

    return filtered
