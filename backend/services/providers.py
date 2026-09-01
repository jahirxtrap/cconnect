"""Models served by an Anthropic-compatible provider an account points at."""

from __future__ import annotations

import httpx
from loguru import logger

DEFAULT_BASE_URL = "http://127.0.0.1:11434"

_TIMEOUT = 5.0
_TOOLS = "tools"


def _window(value: object) -> int | None:
    return value if isinstance(value, int) and value > 0 else None


def _model(name: str, description: str = "", window: int | None = None) -> dict:
    return {
        "id": name,
        "label": name,
        "description": description,
        "resolved_model": name,
        "effort_levels": [],
        "context_window": window,
        "fast_mode": False,
        "auto_mode": False,
    }


def _tagged(raw: dict) -> dict | None:
    name = raw.get("name") or raw.get("model")
    if not name or _TOOLS not in (raw.get("capabilities") or []):
        return None
    details = raw.get("details") or {}
    parts = (details.get("parameter_size") or "", details.get("quantization_level") or "")
    return _model(name, " · ".join(p for p in parts if p), _window(details.get("context_length")))


def _listed(raw: dict) -> dict | None:
    name = raw.get("id")
    return _model(name) if name else None


async def _get(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.debug(f"provider listing failed at {url}: {type(exc).__name__}: {exc}")
        return None
    return payload if isinstance(payload, dict) else None


async def models(base_url: str) -> list[dict]:
    if not base_url:
        return []
    root = base_url.rstrip("/")
    found: list[dict] = []
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        tagged = await _get(client, f"{root}/api/tags")
        raw = (tagged or {}).get("models")
        if isinstance(raw, list):
            found = [entry for entry in (_tagged(item) for item in raw if isinstance(item, dict)) if entry]
        if not found:
            listed = await _get(client, f"{root}/v1/models")
            raw = (listed or {}).get("data")
            if isinstance(raw, list):
                found = [entry for entry in (_listed(item) for item in raw if isinstance(item, dict)) if entry]
    return sorted(found, key=lambda entry: entry["id"])


async def detect(base_url: str = "") -> dict:
    url = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    listed = await models(url)
    return {"base_url": url, "models": [entry["id"] for entry in listed], "found": bool(listed)}
