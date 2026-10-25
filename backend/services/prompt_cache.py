from datetime import datetime
from typing import Iterable, Optional

TTLS = (("ephemeral_1h_input_tokens", 3600), ("ephemeral_5m_input_tokens", 300))


def input_tokens(usage: dict) -> int:
    return (
        (usage.get("input_tokens") or 0)
        + (usage.get("cache_read_input_tokens") or 0)
        + (usage.get("cache_creation_input_tokens") or 0)
    )


def ttl_of(usage: dict, current: Optional[int]) -> Optional[int]:
    written = usage.get("cache_creation") or {}
    return next((seconds for field, seconds in TTLS if (written.get(field) or 0) > 0), current)


def window(usage: dict, started_at: float, ttl: Optional[int]) -> Optional[dict]:
    total = input_tokens(usage)
    if not ttl or not total:
        return None
    return {
        "expires_at": int((started_at + ttl) * 1000),
        "ttl": ttl,
        "read_ratio": round((usage.get("cache_read_input_tokens") or 0) / total, 3),
    }


def _stamp(entry: dict) -> Optional[float]:
    try:
        return datetime.fromisoformat(entry["timestamp"]).timestamp()
    except (KeyError, TypeError, ValueError):
        return None


def from_entries(entries: Iterable[dict]) -> Optional[dict]:
    started: Optional[float] = None
    ttl: Optional[int] = None
    found: Optional[dict] = None
    for entry in entries:
        if entry.get("isSidechain"):
            continue
        if entry.get("type") == "user":
            started = _stamp(entry) or started
            continue
        message = entry.get("message")
        usage = message.get("usage") if entry.get("type") == "assistant" and isinstance(message, dict) else None
        if not isinstance(usage, dict):
            continue
        ttl = ttl_of(usage, ttl)
        begun = started or _stamp(entry)
        if begun is not None:
            found = window(usage, begun, ttl) or found
    return found
