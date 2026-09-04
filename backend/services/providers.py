"""Models served by an Anthropic-compatible provider an account points at."""

from __future__ import annotations

from typing import Optional

import httpx
from loguru import logger

DEFAULT_BASE_URL = "http://127.0.0.1:11434"
ANTHROPIC_BASE_URL = "https://api.anthropic.com"

PRESETS = (
    {"id": "anthropic", "label": "Anthropic", "base_url": ANTHROPIC_BASE_URL, "pin_model": False},
    {"id": "omniroute", "label": "OmniRoute", "base_url": "http://127.0.0.1:20128", "pin_model": True},
    {"id": "ollama", "label": "Ollama", "base_url": DEFAULT_BASE_URL, "pin_model": True},
)

_TIMEOUT = 5.0
_TOOLS = "tools"
_THINKING = "thinking"
_VERSION_HEADER = {"anthropic-version": "2023-06-01"}


def preset_for(base_url: str) -> dict:
    url = (base_url or "").strip().rstrip("/")
    return next((preset for preset in PRESETS if preset["base_url"] == url), {})


def pins_model(base_url: str) -> bool:
    """A provider serving its own models needs one pinned; an Anthropic endpoint knows the aliases."""
    return preset_for(base_url).get("pin_model", True)


def _window(value: object) -> int | None:
    return value if isinstance(value, int) and value > 0 else None


def _model(name: str, description: str = "", window: int | None = None, thinking: bool = False) -> dict:
    return {
        "id": name,
        "label": name,
        "description": description,
        "resolved_model": name,
        "effort_levels": [],
        "context_window": window,
        "fast_mode": False,
        "auto_mode": False,
        "thinking": thinking,
    }


def _tagged(raw: dict) -> dict | None:
    name = raw.get("name") or raw.get("model")
    capabilities = raw.get("capabilities") or []
    if not name or _TOOLS not in capabilities:
        return None
    details = raw.get("details") or {}
    parts = (details.get("parameter_size") or "", details.get("quantization_level") or "")
    return _model(
        name,
        " · ".join(p for p in parts if p),
        _window(details.get("context_length")),
        _THINKING in capabilities,
    )


def _listed(raw: dict) -> dict | None:
    name = raw.get("id")
    if not name:
        return None
    capabilities = raw.get("capabilities")
    if isinstance(capabilities, dict) and not capabilities.get("tool_calling", True):
        return None
    label = raw.get("name") or raw.get("owned_by") or ""
    thinking = bool(raw.get("supportsThinking")) or bool(
        isinstance(capabilities, dict) and (capabilities.get(_THINKING) or capabilities.get("reasoning"))
    )
    return _model(name, label if label != name else "", _window(raw.get("context_length")), thinking)


async def _get(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.debug(f"provider listing failed at {url}: {type(exc).__name__}: {exc}")
        return None
    return payload if isinstance(payload, dict) else None


async def models(base_url: str, headers: Optional[dict] = None) -> list[dict]:
    if not base_url:
        return []
    root = base_url.rstrip("/")
    found: list[dict] = []
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers={**_VERSION_HEADER, **(headers or {})}) as client:
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


async def detect(base_url: str = "", headers: Optional[dict] = None) -> dict:
    url = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    listed = await models(url, headers)
    return {"base_url": url, "models": [entry["id"] for entry in listed], "found": bool(listed)}
