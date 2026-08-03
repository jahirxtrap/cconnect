"""Claude accounts: isolated credentials over a shared history, plugins and skills.

Each account is a ``CLAUDE_CONFIG_DIR`` of its own, so the CLI keeps refreshing its
credentials as usual. The directories that must stay common are linked back to the
primary config dir instead of being copied.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess

import sys
from pathlib import Path
from typing import Optional

from core.config import CLAUDE_PROJECTS_DIR
from services import settings_store

_WINDOWS = sys.platform == "win32"

PRIMARY_ID = "default"
PRIMARY_LABEL = "Default"

_ACCOUNTS_DIR = Path(__file__).resolve().parent.parent / "accounts"
_META_FILE = "account.json"
_SHARED_DIRS = ("projects", "plugins", "skills")
_COPIED_FILES = ("settings.json",)
_ID_RE = re.compile(r"[^a-z0-9-]+")


def primary_dir() -> Path:
    return Path(CLAUDE_PROJECTS_DIR).parent


def config_dir(account_id: Optional[str]) -> Optional[Path]:
    """Config dir for an account, or None for the primary one (the CLI default)."""
    if not account_id or account_id == PRIMARY_ID:
        return None
    path = _ACCOUNTS_DIR / account_id
    return path if path.is_dir() else None


def env_for(account_id: Optional[str]) -> dict[str, str]:
    """Environment overrides to run the CLI as this account."""
    path = config_dir(account_id)
    return {"CLAUDE_CONFIG_DIR": str(path)} if path else {}


def credentials_path(account_id: Optional[str] = None) -> Path:
    return (config_dir(account_id) or primary_dir()) / ".credentials.json"


def _claude_json(account_id: Optional[str]) -> Path:
    path = config_dir(account_id)
    return (path / ".claude.json") if path else (Path.home() / ".claude.json")


def is_logged_in(account_id: Optional[str]) -> bool:
    executable = shutil.which("claude")
    if executable:
        env = dict(os.environ)
        env.update(env_for(account_id))
        try:
            result = subprocess.run(
                [executable, "auth", "status", "--json"],
                env=env, capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=20, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
            return bool(json.loads(result.stdout or "{}").get("loggedIn"))
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
            pass
    try:
        data = json.loads(credentials_path(account_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return bool((data.get("claudeAiOauth") or {}).get("accessToken"))


def _label(path: Path, fallback: str) -> str:
    try:
        return json.loads((path / _META_FILE).read_text(encoding="utf-8")).get("label") or fallback
    except (OSError, json.JSONDecodeError):
        return fallback


def list_accounts() -> list[dict]:
    items = [{
        "id": PRIMARY_ID,
        "label": _label(primary_dir(), PRIMARY_LABEL),
        "logged_in": is_logged_in(None),
        "primary": True,
    }]
    if _ACCOUNTS_DIR.is_dir():
        for entry in sorted(_ACCOUNTS_DIR.iterdir()):
            if entry.is_dir():
                items.append({
                    "id": entry.name,
                    "label": _label(entry, entry.name),
                    "logged_in": is_logged_in(entry.name),
                    "primary": False,
                })
    return items


def default_account() -> str:
    stored = settings_store.get("account")
    known = {a["id"] for a in list_accounts()}
    return stored if stored in known else PRIMARY_ID


def resolve(account_id: Optional[str]) -> str:
    known = {a["id"] for a in list_accounts()}
    return account_id if account_id in known else default_account()


def _link_dir(source: Path, target: Path) -> None:
    if target.exists() or target.is_symlink():
        return
    source.mkdir(parents=True, exist_ok=True)
    if _WINDOWS:
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(target), str(source)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    else:
        target.symlink_to(source, target_is_directory=True)


def _unlink_dir(target: Path) -> None:
    """Detach a link without touching what it points at."""
    if not target.exists() and not target.is_symlink():
        return
    if _WINDOWS:
        subprocess.run(
            ["cmd", "/c", "rmdir", str(target)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    else:
        target.unlink()


def _slug(label: str, taken: set[str]) -> str:
    base = _ID_RE.sub("-", label.strip().lower()).strip("-") or "account"
    if base == PRIMARY_ID:
        base = f"{base}-1"
    candidate, index = base, 2
    while candidate in taken:
        candidate = f"{base}-{index}"
        index += 1
    return candidate


def create(label: str) -> dict:
    taken = {a["id"] for a in list_accounts()}
    account_id = _slug(label, taken)
    path = _ACCOUNTS_DIR / account_id
    path.mkdir(parents=True, exist_ok=True)
    (path / _META_FILE).write_text(json.dumps({"label": label.strip() or account_id}), encoding="utf-8")
    primary = primary_dir()
    for name in _SHARED_DIRS:
        _link_dir(primary / name, path / name)
    for name in _COPIED_FILES:
        source = primary / name
        if source.is_file():
            shutil.copy2(source, path / name)
    sync_mcp_servers(account_id)
    return {"id": account_id, "label": label, "logged_in": False, "primary": False}


def delete(account_id: str) -> bool:
    path = config_dir(account_id)
    if path is None:
        return False
    for name in _SHARED_DIRS:
        _unlink_dir(path / name)
    shutil.rmtree(path, ignore_errors=True)
    if settings_store.get("account") == account_id:
        settings_store.set("account", None)
    return True


def rename(account_id: str, label: str) -> bool:
    path = config_dir(account_id) if account_id != PRIMARY_ID else primary_dir()
    if path is None:
        return False
    (path / _META_FILE).write_text(json.dumps({"label": label.strip() or account_id}), encoding="utf-8")
    return True


def sync_mcp_servers(account_id: str) -> None:
    """Mirror the primary account's local MCP servers into this account's config."""
    target = _claude_json(account_id)
    if target is None:
        return
    try:
        servers = json.loads(_claude_json(None).read_text(encoding="utf-8")).get("mcpServers") or {}
    except (OSError, json.JSONDecodeError):
        return
    if not servers:
        return
    try:
        current = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        current = {}
    current["mcpServers"] = servers
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, indent=2), encoding="utf-8")


def sync_all_mcp_servers() -> None:
    for account in list_accounts():
        if not account["primary"]:
            sync_mcp_servers(account["id"])
