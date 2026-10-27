"""What a chat can hand a task to: the agents and the accounts the user offers Claude."""

import json
from typing import Any, Optional

from core import paths
from services import accounts, agents

TOOL = "delegate"
TOOL_ID = f"mcp__cconnect__{TOOL}"
TASK_TOKEN = "{task}"
ACCOUNT = "account"
ACCOUNT_PREFIX = "account:"
LEGACY_PROTOCOLS = {"acp": agents.ACP, "command": agents.COMMAND}
LEGACY_ACCOUNT_KINDS = ("model", "claude")


def _agent(agent: dict) -> dict:
    return {**agent, "kind": agent["protocol"], "description": agent["purpose"] or agent["description"]}


def _account(account: dict) -> dict:
    return {
        "id": f"{ACCOUNT_PREFIX}{account['id']}",
        "name": account["label"],
        "kind": ACCOUNT,
        "account": account["id"],
        "description": account["purpose"],
    }


def _offered_accounts() -> list[dict]:
    return [_account(account) for account in accounts.list_accounts() if account["delegate"]]


def destinations() -> list[dict]:
    return [*map(_agent, agents.enabled()), *_offered_accounts()]


def find(ident: str) -> Optional[dict]:
    if ident.startswith(ACCOUNT_PREFIX):
        return next((entry for entry in _offered_accounts() if entry["id"] == ident), None)
    return next((_agent(agent) for agent in agents.enabled() if agent["id"] == ident), None)


def _name_of(ident: str) -> Optional[str]:
    if ident.startswith(ACCOUNT_PREFIX):
        account = ident[len(ACCOUNT_PREFIX):]
        return next((item["label"] for item in accounts.list_accounts() if item["id"] == account), None)
    agent = agents.find(ident)
    return agent["name"] if agent else None


def label_of(raw_input: Any) -> tuple[Optional[str], Optional[str]]:
    if not isinstance(raw_input, dict):
        return None, None
    if raw_input.get("action") == "register":
        line = " ".join([str(raw_input.get("command") or ""), *map(str, raw_input.get("args") or [])]).strip()
        return raw_input.get("name") or None, line or None
    ident = str(raw_input.get("destination") or "")
    return _name_of(ident) or ident or None, raw_input.get("task")


def migrate() -> None:
    """Move the destinations registered before agents and accounts held them."""
    try:
        raw = json.loads(paths.DELEGATES_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    known = {account["id"]: account for account in accounts.list_accounts()}
    for entry in raw if isinstance(raw, list) else []:
        if not isinstance(entry, dict):
            continue
        kind = entry.get("kind")
        if kind in LEGACY_PROTOCOLS:
            agents.adopt(entry, LEGACY_PROTOCOLS[kind])
        elif kind in LEGACY_ACCOUNT_KINDS:
            account = known[accounts.resolve(entry.get("account"), set(known))]
            account["delegate"] = account["delegate"] or entry.get("enabled") is not False
            account["purpose"] = account["purpose"] or str(entry.get("description") or "")
            accounts.set_delegation(account["id"], account["delegate"], account["purpose"])
    paths.DELEGATES_FILE.unlink(missing_ok=True)
