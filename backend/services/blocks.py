import json
import re

FENCE_RE = re.compile(r"^([ \t]*)```cconnect[ \t]*\n(.*?)\n?[ \t]*```[ \t]*$", re.DOTALL | re.MULTILINE)

MEDIA_CAPABILITY = "media.blocks"


def _link(item: dict, url_key: str = "url", label_key: str = "title") -> str:
    url = item.get(url_key)
    label = item.get(label_key) or (url or "").split("?")[0].split("#")[0].rsplit("/", 1)[-1]
    return f"[{label}]({url})"


def _degrade(payload: dict) -> str | None:
    kind = payload.get("type")
    items = [it for it in (payload.get("items") or []) if isinstance(it, dict) and it.get("url")]
    if kind == "gallery":
        return "\n".join(f"![{it.get('alt') or ''}]({it['url']})" for it in items) or None
    if kind == "playlist":
        return "\n".join(f"- {_link(it)}" for it in items) or None
    if kind in ("pdf", "html"):
        return _link(payload) if payload.get("url") else None
    return None


def degrade_text(text: str) -> str:
    if not text or "```cconnect" not in text:
        return text

    def replace(match: re.Match) -> str:
        indent, body = match.group(1), match.group(2)
        try:
            payload = json.loads(body)
        except ValueError:
            return match.group(0)
        if not isinstance(payload, dict):
            return match.group(0)
        plain = _degrade(payload)
        if plain is None:
            return match.group(0)
        return "\n".join(f"{indent}{line}" for line in plain.splitlines())

    return FENCE_RE.sub(replace, text)


def degrade_items(items: list[dict]) -> list[dict]:
    out = []
    for item in items:
        text = item.get("text")
        if isinstance(text, str) and "```cconnect" in text:
            item = {**item, "text": degrade_text(text)}
        out.append(item)
    return out
