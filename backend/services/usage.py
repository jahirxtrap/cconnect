"""Plan token usage (session and weekly windows) as a markdown report."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import httpx

from core.cli_manager import bundled_version
from services import accounts

logger = logging.getLogger(__name__)

_USAGE_URL = "https://api.anthropic.com/api/oauth/usage"
_BAR_WIDTH = 20
_UNUSED_KEY = "unused"
_UNUSED_TEXT = "You haven't used it yet"
_SPEND_KEY = "spend"


def _oauth(field: str, account: str | None = None) -> str | None:
    try:
        data = json.loads(accounts.credentials_path(account).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return (data.get("claudeAiOauth") or {}).get(field)


def _plan_label(account: str | None = None) -> str | None:
    subscription = _oauth("subscriptionType", account)
    if not subscription:
        return None
    label = subscription.capitalize()
    match = re.search(r"(\d+x)$", _oauth("rateLimitTier", account) or "")
    return f"{label} ({match.group(1)})" if match else label


async def _fetch(account: str | None = None) -> dict:
    from services import accounts

    provider = accounts.provider_for(account)
    if provider:
        return {"error": f"This account runs on {provider['base_url']}, not on a Claude plan"}
    token = _oauth("accessToken", account)
    if not token:
        return {"error": "No Claude token found (are you signed in to the CLI?)"}
    headers = {
        "Authorization": f"Bearer {token}",
        "anthropic-beta": "oauth-2025-04-20",
        "anthropic-version": "2023-06-01",
        "User-Agent": f"claude-code/{bundled_version() or '2.0.0'}",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(_USAGE_URL, headers=headers)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        hint = " (sign in to the CLI again)" if code in (401, 403) else ""
        return {"error": f"Couldn't fetch usage: {code}{hint}"}
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        logger.debug(f"usage fetch failed: {type(exc).__name__}: {exc}")
        return {"error": f"Couldn't fetch usage: {type(exc).__name__}"}


def _window_id(entry: dict) -> str | None:
    kind = entry.get("kind")
    if kind == "session":
        return "session"
    if kind == "weekly_all":
        return "weekly_all"
    return ((entry.get("scope") or {}).get("model") or {}).get("display_name")


def _alerting(entry: dict) -> bool:
    return entry.get("severity") not in (None, "normal")


def _windows(data: dict) -> list[dict]:
    out: list[dict] = []
    for entry in data.get("limits") or []:
        if not isinstance(entry, dict):
            continue
        pct = entry.get("percent")
        wid = _window_id(entry)
        if wid and isinstance(pct, (int, float)):
            win = {
                "id": wid,
                "percent": float(pct),
                "resets_at": entry.get("resets_at"),
                "alert": _alerting(entry),
            }
            win["unused"] = not win["resets_at"] and round(win["percent"]) == 0
            out.append(win)
    spend = _spend(data)
    if spend is not None:
        out.append(spend)
    return out


def _money(amount: dict | None) -> str | None:
    if not isinstance(amount, dict):
        return None
    minor, exponent = amount.get("amount_minor"), amount.get("exponent")
    if not isinstance(minor, (int, float)) or not isinstance(exponent, int):
        return None
    return f"{minor / (10 ** exponent):.{exponent}f} {amount.get('currency') or ''}".strip()


def _spend(data: dict) -> dict | None:
    """The spend window, only for accounts that turned extra usage on."""
    spend = data.get("spend")
    if not isinstance(spend, dict) or not spend.get("enabled"):
        return None
    pct = spend.get("percent")
    if not isinstance(pct, (int, float)):
        return None
    used, limit = _money(spend.get("used")), _money(spend.get("limit"))
    return {
        "id": _SPEND_KEY,
        "percent": float(pct),
        "resets_at": None,
        "alert": _alerting(spend),
        "unused": False,
        "detail": " / ".join(part for part in (used, limit) if part) or None,
    }


async def usage_data(account: str | None = None) -> dict:
    data = await _fetch(account)
    if "error" in data:
        return {"error": data["error"]}
    return {"plan": _plan_label(account), "windows": _windows(data)}


def window_label(wid: str) -> str:
    if wid == "session":
        return "Current session"
    if wid == "weekly_all":
        return "All models"
    if wid == _SPEND_KEY:
        return "Extra usage"
    return wid


def _bar(pct: float) -> str:
    filled = max(0, min(_BAR_WIDTH, round(pct / 100 * _BAR_WIDTH)))
    return "█" * filled + "░" * (_BAR_WIDTH - filled)


def _resets_hint(value) -> str:
    """Format a reset time (epoch or ISO-8601) as 'resets in Xh Ym'."""
    dt = None
    try:
        if isinstance(value, (int, float)):
            dt = datetime.fromtimestamp(value, tz=timezone.utc)
        elif isinstance(value, str) and value:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, OSError, OverflowError):
        return ""
    if dt is None:
        return ""
    secs = (dt - datetime.now(timezone.utc)).total_seconds()
    if secs <= 0:
        return "resets now"
    d, rem = divmod(int(secs), 86400)
    h, m = rem // 3600, (rem % 3600) // 60
    if d:
        return f"resets in {d}d {h}h"
    if h:
        return f"resets in {h}h {m}m"
    return f"resets in {m}m"


def _window_hint(win: dict) -> str:
    if win.get("detail"):
        return win["detail"]
    return _UNUSED_TEXT if win["unused"] else _resets_hint(win.get("resets_at"))


def _window_md(win: dict) -> str:
    pct = win["percent"]
    lines = [f"**{window_label(win['id'])}** • {round(pct)}%", f"`{_bar(pct)}`"]
    hint = _window_hint(win)
    if hint:
        lines.append(hint)
    return "  \n".join(lines)


def _bar_block(win: dict) -> dict:
    block = {
        "type": "bar",
        "label": window_label(win["id"]),
        "text": win.get("detail") or _resets_hint(win.get("resets_at")),
        "value": round(win["percent"]),
    }
    if win.get("alert"):
        block["alert_above"] = 0
    if win["unused"] and not win.get("detail"):
        block["text_key"] = _UNUSED_KEY
    return block


async def usage_blocks(account: str | None = None) -> list[dict]:
    data = await _fetch(account)
    if "error" in data:
        return [{"type": "text", "text": f"_{data['error']}._"}]
    windows = _windows(data)
    if not windows:
        return [{"type": "text", "text": "_The server returned no usage data._"}]
    return [_bar_block(win) for win in windows]


async def usage_markdown(account: str | None = None) -> str:
    """Fetch plan usage and render it as markdown with per-window utilization bars."""
    data = await _fetch(account)
    if "error" in data:
        return f"_{data['error']}._"
    rows = [_window_md(w) for w in _windows(data)]
    if not rows:
        return "_The server returned no usage data._"
    return "**Token usage**\n\n" + "\n\n".join(rows)
