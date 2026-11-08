"""The security key gating what belongs to the machine itself: shells, ignored files and database connections."""

import hmac
from typing import Optional

from core.config import PUBLIC_ACCESS_TOKEN, SECURITY_KEY

KEY_HEADER = "X-Security-Key"
KEYED_CAPABILITIES = ("terminal", "databases")


def gated() -> bool:
    return PUBLIC_ACCESS_TOKEN is not None


def key_matches(candidate: str) -> bool:
    if not gated():
        return True
    return bool(SECURITY_KEY) and hmac.compare_digest(candidate or "", SECURITY_KEY)


def authorize(capabilities: list[str], key: Optional[str]) -> list[str]:
    if key_matches(key or ""):
        return list(capabilities)
    return [item for item in capabilities if item not in KEYED_CAPABILITIES]
