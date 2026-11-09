from __future__ import annotations

import io
import json
import os
import re
import zipfile

import psutil
from base64 import b64encode
from contextlib import suppress
from pathlib import Path
from typing import Optional

from core import paths
from core.config import CLAUDE_PROJECTS_DIR
from core.slugs import unique
from services import files, providers, settings_store

PRIMARY_ID = "default"
PRIMARY_LABEL = "Default"
PROVIDER_TOKEN = "cconnect"

AUTH_NONE = "none"
AUTH_BEARER = "bearer"
AUTH_API_KEY = "api_key"
AUTH_BASIC = "basic"
AUTH_HEADER = "header"

_MODEL_ALIASES = ("SONNET", "OPUS", "HAIKU")

_META_FILE = "account.json"
_DELETING = ".deleting"
_ID_RE = re.compile(r"[^a-z0-9-]+")

_CREDENTIALS_FILE = ".credentials.json"
_IDENTITY_FILE = ".claude.json"
_BUNDLE_FILES = (_CREDENTIALS_FILE, _IDENTITY_FILE, _META_FILE)
_IDENTITY_KEYS = ("oauthAccount", "userID")
_EMAIL_KEY = "emailAddress"
_PLAN_KEY = "planDisplayName"

_MAX_BUNDLE_BYTES = 2 * 1024 * 1024


def primary_dir() -> Path:
    return Path(CLAUDE_PROJECTS_DIR).parent


def config_dir(account_id: Optional[str]) -> Optional[Path]:
    if not account_id or account_id == PRIMARY_ID:
        return None
    path = paths.ACCOUNTS_DIR / account_id
    return path if path.is_dir() and not _tombstone(account_id).exists() else None


def _tombstone(account_id: str) -> Path:
    return paths.ACCOUNTS_DIR / f"{account_id}{_DELETING}"


def provider_for(account_id: Optional[str]) -> dict:
    path = config_dir(account_id)
    if path is None:
        return {}
    try:
        stored = json.loads((path / _META_FILE).read_text(encoding="utf-8")).get("provider")
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}
    return stored if isinstance(stored, dict) and stored.get("base_url") else {}


def context_scope(account_id: Optional[str]) -> dict:
    provider = provider_for(account_id)
    return providers.scope_for(provider.get("context_scope") if provider else providers.FULL_SCOPE)


def model_for(account_id: Optional[str], alias: str) -> str:
    provider = provider_for(account_id)
    return (provider.get("model") or alias) if provider else alias


def auth_headers(auth: dict) -> dict[str, str]:
    kind = auth.get("kind") or AUTH_NONE
    token = (auth.get("token") or "").strip()
    if kind == AUTH_BEARER and token:
        return {"Authorization": f"Bearer {token}"}
    if kind == AUTH_API_KEY and token:
        return {"x-api-key": token}
    if kind == AUTH_BASIC and auth.get("user"):
        pair = f"{auth['user']}:{auth.get('password') or ''}".encode()
        return {"Authorization": f"Basic {b64encode(pair).decode()}"}
    name = (auth.get("header_name") or "").strip()
    if kind == AUTH_HEADER and name:
        return {name: auth.get("header_value") or ""}
    return {}


def _auth_env(auth: dict) -> dict[str, str]:
    kind = auth.get("kind") or AUTH_NONE
    token = (auth.get("token") or "").strip()
    if kind == AUTH_BEARER and token:
        return {"ANTHROPIC_AUTH_TOKEN": token}
    if kind == AUTH_API_KEY and token:
        return {"ANTHROPIC_API_KEY": token}
    headers = auth_headers(auth)
    if headers:
        return {"ANTHROPIC_CUSTOM_HEADERS": "\n".join(f"{name}: {value}" for name, value in headers.items())}
    return {"ANTHROPIC_AUTH_TOKEN": PROVIDER_TOKEN}


def env_for(account_id: Optional[str]) -> dict[str, str]:
    path = config_dir(account_id)
    env = {"CLAUDE_SECURESTORAGE_CONFIG_DIR": str(path)} if path else {}
    provider = provider_for(account_id)
    if not provider:
        return env
    env["ANTHROPIC_BASE_URL"] = provider["base_url"]
    env.update(_auth_env(provider.get("auth") or {}))
    fallback = provider.get("model") or ""
    if fallback:
        for alias in _MODEL_ALIASES:
            env[f"ANTHROPIC_DEFAULT_{alias}_MODEL"] = fallback
    return env


def _identity_dir(account_id: Optional[str]) -> Path:
    return config_dir(account_id) or paths.ACCOUNTS_DIR / PRIMARY_ID


def identity_file(account_id: Optional[str]) -> Path:
    return _identity_dir(account_id) / _IDENTITY_FILE


def identity_env(account_id: Optional[str]) -> dict[str, str]:
    """The shared .claude.json holds whichever login wrote it last, so each login signs in and reads its own identity, plan and models in a folder of its own."""
    folder = _identity_dir(account_id)
    folder.mkdir(parents=True, exist_ok=True)
    return {"CLAUDE_CONFIG_DIR": str(folder), "CLAUDE_SECURESTORAGE_CONFIG_DIR": str(credentials_path(account_id).parent)}


def credentials_path(account_id: Optional[str] = None) -> Path:
    return (config_dir(account_id) or primary_dir()) / ".credentials.json"


def _claude_json(account_id: Optional[str]) -> Path:
    own = identity_file(account_id)
    if own.is_file() or config_dir(account_id):
        return own
    configured = os.environ.get("CLAUDE_CONFIG_DIR")
    return Path(configured) / ".claude.json" if configured else Path.home() / ".claude.json"


def _credentials(account_id: Optional[str]) -> dict:
    try:
        data = json.loads(credentials_path(account_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def is_logged_in(account_id: Optional[str]) -> bool:
    return bool((_credentials(account_id).get("claudeAiOauth") or {}).get("accessToken"))


def mcp_tokens(account_id: Optional[str]) -> dict[str, str]:
    entries = _credentials(account_id).get("mcpOAuth")
    tokens: dict[str, str] = {}
    for entry in entries.values() if isinstance(entries, dict) else ():
        name = entry.get("serverName") if isinstance(entry, dict) else None
        if isinstance(name, str):
            tokens[name] = tokens.get(name) or str(entry.get("accessToken") or "")
    return tokens


def mcp_entries(account_id: Optional[str], server: str) -> dict[str, dict]:
    entries = _credentials(account_id).get("mcpOAuth")
    if not isinstance(entries, dict):
        return {}
    return {key: entry for key, entry in entries.items() if isinstance(entry, dict) and entry.get("serverName") == server}


def restore_mcp_entries(account_id: Optional[str], server: str, saved: dict[str, dict]) -> None:
    """Puts back an MCP server's sign-in that the CLI cleared when a new sign-in started and that never got replaced."""
    if not any(entry.get("accessToken") for entry in saved.values()) or mcp_tokens(account_id).get(server):
        return
    target = credentials_path(account_id)
    data = _credentials(account_id)
    current = data.get("mcpOAuth")
    data["mcpOAuth"] = {**(current if isinstance(current, dict) else {}), **saved}
    mode = target.stat().st_mode if target.exists() else None
    files.write_json(target, data)
    if mode is not None:
        os.chmod(target, mode)


def _meta(path: Path) -> dict:
    try:
        stored = json.loads((path / _META_FILE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return stored if isinstance(stored, dict) else {}


def _label(path: Path, fallback: str) -> str:
    return _meta(path).get("label") or fallback


def _delegation(path: Path) -> dict:
    meta = _meta(path)
    return {"delegate": meta.get("delegate") is True, "purpose": str(meta.get("purpose") or "")}


def _account_dirs() -> list[Path]:
    if not paths.ACCOUNTS_DIR.is_dir():
        return []
    return [
        entry for entry in sorted(paths.ACCOUNTS_DIR.iterdir())
        if entry.is_dir() and not entry.name.endswith(".lock") and config_dir(entry.name) is not None
    ]


def list_accounts() -> list[dict]:
    items = [{
        "id": PRIMARY_ID,
        "label": _label(primary_dir(), PRIMARY_LABEL),
        "logged_in": is_logged_in(None),
        "primary": True,
        "provider": None,
        **_delegation(primary_dir()),
    }]
    for entry in _account_dirs():
        provider = provider_for(entry.name)
        items.append({
            "id": entry.name,
            "label": _label(entry, entry.name),
            "logged_in": bool(provider) or is_logged_in(entry.name),
            "primary": False,
            "provider": {
                "base_url": provider["base_url"],
                "model": provider["model"],
                "context_scope": providers.scope_for(provider.get("context_scope"))["id"],
            } if provider else None,
            **_delegation(entry),
        })
    return items


def known_ids() -> set[str]:
    return {PRIMARY_ID, *(entry.name for entry in _account_dirs())}


def default_account(known: Optional[set[str]] = None) -> str:
    stored = settings_store.get("account")
    return stored if stored in (known if known is not None else known_ids()) else PRIMARY_ID


def resolve(account_id: Optional[str], known: Optional[set[str]] = None) -> str:
    ids = known if known is not None else known_ids()
    return account_id if account_id in ids else default_account(ids)


def _slug(label: str, taken: set[str]) -> str:
    base = _ID_RE.sub("-", label.strip().lower()).strip("-") or "account"
    if base == PRIMARY_ID:
        base = f"{base}-1"
    return unique(base, taken)


def create(label: str) -> dict:
    taken = known_ids() | {marker.name.removesuffix(_DELETING) for marker in paths.ACCOUNTS_DIR.glob(f"*{_DELETING}")}
    account_id = _slug(label, taken)
    path = paths.ACCOUNTS_DIR / account_id
    path.mkdir(parents=True, exist_ok=True)
    files.write_json(path / _META_FILE, {"label": label.strip() or account_id})
    return {"id": account_id, "label": label, "logged_in": False, "primary": False, "provider": None}


def forget(account_id: str) -> bool:
    if config_dir(account_id) is None:
        return False
    _tombstone(account_id).touch()
    if settings_store.get("account") == account_id:
        settings_store.set("account", None)
    return True


def purge(account_id: str) -> bool:
    path = paths.ACCOUNTS_DIR / account_id
    if path.is_dir():
        for entry in path.iterdir():
            if paths.is_link(entry):
                paths.unlink_dir(entry)
        if any(paths.is_link(entry) for entry in path.iterdir()):
            return False
        _stop_processes_in(path)
        if not paths.remove_tree(path):
            return False
    _tombstone(account_id).unlink(missing_ok=True)
    return True


def purge_forgotten() -> None:
    if not paths.ACCOUNTS_DIR.is_dir():
        return
    for marker in paths.ACCOUNTS_DIR.glob(f"*{_DELETING}"):
        purge(marker.name.removesuffix(_DELETING))


def _stop_processes_in(folder: Path) -> None:
    for process in psutil.process_iter(["exe"]):
        exe = process.info.get("exe")
        if exe and Path(exe).is_relative_to(folder):
            with suppress(psutil.Error):
                for child in process.children(recursive=True):
                    child.kill()
                process.kill()


def _write_meta(account_id: str, changes: dict) -> bool:
    path = config_dir(account_id) if account_id != PRIMARY_ID else primary_dir()
    if path is None:
        return False
    files.write_json(path / _META_FILE, {**_meta(path), **changes})
    return True


def rename(account_id: str, label: str) -> bool:
    return _write_meta(account_id, {"label": label.strip() or account_id})


def set_delegation(account_id: str, delegate: bool, purpose: str) -> bool:
    return _write_meta(account_id, {"delegate": delegate, "purpose": purpose.strip()})


def _provider(base_url: str, model: str, auth: Optional[dict], scope: str) -> dict:
    wanted = scope.strip() or providers.default_scope_for(base_url)
    return {
        "base_url": base_url,
        "model": model.strip(),
        "auth": auth or {},
        "context_scope": providers.scope_for(wanted)["id"],
    }


def update_provider(
    account_id: str,
    base_url: str,
    model: str = "",
    auth: Optional[dict] = None,
    scope: str = "",
) -> bool:
    path = config_dir(account_id)
    url = base_url.strip().rstrip("/")
    if path is None or not url or not provider_for(account_id):
        return False
    meta = {**_meta(path), "provider": _provider(url, model, auth, scope)}
    files.write_json(path / _META_FILE, meta)
    return True


def create_provider(
    label: str,
    base_url: str,
    model: str = "",
    auth: Optional[dict] = None,
    scope: str = "",
) -> Optional[dict]:
    url = base_url.strip().rstrip("/")
    if not url:
        return None
    account = create(label)
    path = paths.ACCOUNTS_DIR / account["id"]
    provider = _provider(url, model, auth, scope)
    files.write_json(path / _META_FILE, {"label": account["label"], "provider": provider})
    account["logged_in"] = True
    account["provider"] = {
        "base_url": url,
        "model": provider["model"],
        "context_scope": provider["context_scope"],
    }
    return account


def _identity(account_id: Optional[str]) -> dict:
    try:
        data = json.loads(_claude_json(account_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, AttributeError):
        return {}
    return {key: data[key] for key in _IDENTITY_KEYS if key in data}


def signed_in_as(account_id: Optional[str]) -> dict[str, Optional[str]]:
    account = _identity(account_id).get("oauthAccount")
    fields = account if isinstance(account, dict) else {}
    return {
        name: value if isinstance(value, str) and value.strip() else None
        for name, value in (("email", fields.get(_EMAIL_KEY)), ("plan", fields.get(_PLAN_KEY)))
    }


def plan_name(account_id: Optional[str]) -> Optional[str]:
    return signed_in_as(account_id)["plan"]


def export_bundle(account_id: str) -> Optional[bytes]:
    if account_id not in known_ids():
        return None
    credentials = credentials_path(account_id)
    provider = provider_for(account_id)
    if not credentials.is_file() and not provider:
        return None
    base = config_dir(account_id) or primary_dir()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as bundle:
        if credentials.is_file():
            bundle.writestr(_CREDENTIALS_FILE, credentials.read_bytes())
        fallback = PRIMARY_LABEL if account_id == PRIMARY_ID else account_id
        meta = {"label": _label(base, fallback)}
        if provider:
            meta["provider"] = provider
        bundle.writestr(_META_FILE, json.dumps(meta))
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
            if sum(bundle.getinfo(name).file_size for name in names) > _MAX_BUNDLE_BYTES:
                return None
            payload = {name: bundle.read(name) for name in _BUNDLE_FILES if name in names}
    except (zipfile.BadZipFile, OSError, KeyError):
        return None
    if _CREDENTIALS_FILE not in payload:
        return payload if _bundle_provider(payload) else None
    try:
        json.loads(payload[_CREDENTIALS_FILE])
    except json.JSONDecodeError:
        return None
    return payload


def _bundle_meta(payload: dict[str, bytes]) -> dict:
    try:
        stored = json.loads(payload[_META_FILE])
    except (KeyError, json.JSONDecodeError):
        return {}
    return stored if isinstance(stored, dict) else {}


def _bundle_provider(payload: dict[str, bytes]) -> dict:
    provider = _bundle_meta(payload).get("provider")
    return provider if isinstance(provider, dict) and provider.get("base_url") else {}


def _bundle_label(payload: dict[str, bytes]) -> str:
    return (_bundle_meta(payload).get("label") or "").strip()


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
    payload = _read_bundle(data)
    if payload is None:
        return None
    account = create(label.strip() or _bundle_label(payload) or "Account")
    path = paths.ACCOUNTS_DIR / account["id"]
    if _CREDENTIALS_FILE in payload:
        (path / _CREDENTIALS_FILE).write_bytes(payload[_CREDENTIALS_FILE])
    _merge_identity(path / _IDENTITY_FILE, payload.get(_IDENTITY_FILE))
    provider = _bundle_provider(payload)
    if provider:
        meta = {"label": account["label"], "provider": provider}
        files.write_json(path / _META_FILE, meta)
        account["provider"] = {"base_url": provider["base_url"], "model": provider.get("model", "")}
    account["logged_in"] = bool(provider) or is_logged_in(account["id"])
    return account
