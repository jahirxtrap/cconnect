"""Claude accounts: isolated credentials over a shared history, plugins and skills.

Each account is a ``CLAUDE_CONFIG_DIR`` of its own, so the CLI keeps refreshing its
credentials as usual. The directories that must stay common are linked back to the
primary config dir instead of being copied.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import subprocess
import zipfile

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

_CREDENTIALS_FILE = ".credentials.json"
_IDENTITY_FILE = ".claude.json"
_BUNDLE_FILES = (_CREDENTIALS_FILE, "settings.json", _IDENTITY_FILE, _META_FILE)
_IDENTITY_KEYS = ("oauthAccount", "userID")

# Keys a secondary account always takes from the primary instead of keeping its own.
_SHARED_KEYS = ("mcpServers",)
_SHARED_SETTINGS_KEYS = ("enabledPlugins", "extraKnownMarketplaces")
_MAX_BUNDLE_BYTES = 2 * 1024 * 1024


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
            if entry.is_dir() and not entry.name.endswith(".lock"):
                items.append({
                    "id": entry.name,
                    "label": _label(entry, entry.name),
                    "logged_in": is_logged_in(entry.name),
                    "primary": False,
                })
    return items


def known_ids() -> set[str]:
    return {a["id"] for a in list_accounts()}


def default_account(known: Optional[set[str]] = None) -> str:
    stored = settings_store.get("account")
    return stored if stored in (known if known is not None else known_ids()) else PRIMARY_ID


def resolve(account_id: Optional[str], known: Optional[set[str]] = None) -> str:
    ids = known if known is not None else known_ids()
    return account_id if account_id in ids else default_account(ids)


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
    sync_shared_config(account_id)
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


def _identity(account_id: Optional[str]) -> dict:
    try:
        data = json.loads(_claude_json(account_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}
    return {key: data[key] for key in _IDENTITY_KEYS if key in data}


def export_bundle(account_id: str) -> Optional[bytes]:
    """Zip the credentials and the account's own config. History, caches, the
    machine id and the linked projects/plugins/skills are all left out."""
    if account_id not in known_ids():
        return None
    credentials = credentials_path(account_id)
    if not credentials.is_file():
        return None
    base = config_dir(account_id) or primary_dir()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr(_CREDENTIALS_FILE, credentials.read_bytes())
        fallback = PRIMARY_LABEL if account_id == PRIMARY_ID else account_id
        bundle.writestr(_META_FILE, json.dumps({"label": _label(base, fallback)}))
        settings = base / "settings.json"
        if settings.is_file():
            bundle.writestr("settings.json", settings.read_bytes())
        identity = _identity(account_id)
        if identity:
            bundle.writestr(_IDENTITY_FILE, json.dumps(identity, indent=2))
    return buffer.getvalue()


def _read_bundle(data: bytes) -> Optional[dict[str, bytes]]:
    if len(data) > _MAX_BUNDLE_BYTES:
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as bundle:
            names = set(bundle.namelist())
            if _CREDENTIALS_FILE not in names:
                return None
            if sum(bundle.getinfo(name).file_size for name in names) > _MAX_BUNDLE_BYTES:
                return None
            payload = {name: bundle.read(name) for name in _BUNDLE_FILES if name in names}
    except (zipfile.BadZipFile, OSError, KeyError):
        return None
    try:
        json.loads(payload[_CREDENTIALS_FILE])
    except json.JSONDecodeError:
        return None
    return payload


def _bundle_label(payload: dict[str, bytes]) -> str:
    try:
        return (json.loads(payload[_META_FILE]).get("label") or "").strip()
    except (KeyError, json.JSONDecodeError, AttributeError):
        return ""


def _merge_identity(target: Path, raw: Optional[bytes]) -> None:
    if raw is None:
        return
    try:
        incoming = {k: v for k, v in json.loads(raw).items() if k in _IDENTITY_KEYS}
    except (json.JSONDecodeError, AttributeError):
        return
    if not incoming:
        return
    try:
        current = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        current = {}
    current.update(incoming)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, indent=2), encoding="utf-8")


def import_bundle(data: bytes, label: str = "") -> Optional[dict]:
    """Always lands on a new account, so importing never overwrites a live one."""
    payload = _read_bundle(data)
    if payload is None:
        return None
    account = create(label.strip() or _bundle_label(payload) or "Account")
    path = _ACCOUNTS_DIR / account["id"]
    (path / _CREDENTIALS_FILE).write_bytes(payload[_CREDENTIALS_FILE])
    if "settings.json" in payload:
        (path / "settings.json").write_bytes(payload["settings.json"])
    _merge_identity(path / _IDENTITY_FILE, payload.get(_IDENTITY_FILE))
    account["logged_in"] = is_logged_in(account["id"])
    return account


def _merge_shared(source: Path, target: Path, keys: tuple[str, ...]) -> None:
    try:
        primary = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    try:
        current = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        current = {}
    for key in keys:
        if key in primary:
            current[key] = primary[key]
        else:
            current.pop(key, None)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, indent=2), encoding="utf-8")


def sync_shared_config(account_id: str) -> None:
    """Overwrite this account's shared keys with the primary's, leaving the rest untouched."""
    path = config_dir(account_id)
    if path is None:
        return
    _merge_shared(_claude_json(None), _claude_json(account_id), _SHARED_KEYS)
    _merge_shared(primary_dir() / "settings.json", path / "settings.json", _SHARED_SETTINGS_KEYS)


def sync_all_shared_config() -> None:
    for account in list_accounts():
        if not account["primary"]:
            sync_shared_config(account["id"])
