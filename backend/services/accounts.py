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
from base64 import b64encode
from pathlib import Path
from typing import Optional

from core.config import CLAUDE_PROJECTS_DIR
from services import cli_settings, providers, settings_store

_WINDOWS = sys.platform == "win32"

PRIMARY_ID = "default"
PRIMARY_LABEL = "Default"
PROVIDER_TOKEN = "cconnect"

AUTH_NONE = "none"
AUTH_BEARER = "bearer"
AUTH_API_KEY = "api_key"
AUTH_BASIC = "basic"
AUTH_HEADER = "header"

_MODEL_ALIASES = ("SONNET", "OPUS", "HAIKU")

_ACCOUNTS_DIR = Path(__file__).resolve().parent.parent / "accounts"
_synced: dict[str, tuple[int, ...]] = {}
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
_SHARED_SETTINGS_KEYS = ("enabledPlugins", "extraKnownMarketplaces") + cli_settings.json_keys()
_MAX_BUNDLE_BYTES = 2 * 1024 * 1024


def primary_dir() -> Path:
    return Path(CLAUDE_PROJECTS_DIR).parent


def config_dir(account_id: Optional[str]) -> Optional[Path]:
    """Config dir for an account, or None for the primary one (the CLI default)."""
    if not account_id or account_id == PRIMARY_ID:
        return None
    path = _ACCOUNTS_DIR / account_id
    return path if path.is_dir() else None


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
    """A Claude alias means nothing to a provider, which only serves its own models."""
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
    """Environment overrides to run the CLI as this account, with its shared config brought up to date."""
    path = config_dir(account_id)
    if path is not None:
        sync_shared_config(account_id)
    env = {"CLAUDE_CONFIG_DIR": str(path)} if path else {}
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


def _meta(path: Path) -> dict:
    try:
        stored = json.loads((path / _META_FILE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return stored if isinstance(stored, dict) else {}


def _label(path: Path, fallback: str) -> str:
    return _meta(path).get("label") or fallback


def list_accounts() -> list[dict]:
    items = [{
        "id": PRIMARY_ID,
        "label": _label(primary_dir(), PRIMARY_LABEL),
        "logged_in": is_logged_in(None),
        "primary": True,
        "provider": None,
    }]
    if _ACCOUNTS_DIR.is_dir():
        for entry in sorted(_ACCOUNTS_DIR.iterdir()):
            if entry.is_dir() and not entry.name.endswith(".lock"):
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
    return {"id": account_id, "label": label, "logged_in": False, "primary": False, "provider": None}


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
    meta = {**_meta(path), "label": label.strip() or account_id}
    (path / _META_FILE).write_text(json.dumps(meta), encoding="utf-8")
    return True


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
    (path / _META_FILE).write_text(json.dumps(meta), encoding="utf-8")
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
    path = _ACCOUNTS_DIR / account["id"]
    provider = _provider(url, model, auth, scope)
    (path / _META_FILE).write_text(
        json.dumps({"label": account["label"], "provider": provider}), encoding="utf-8"
    )
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


def export_bundle(account_id: str) -> Optional[bytes]:
    """Zip the credentials and the account's own config. History, caches, the
    machine id and the linked projects/plugins/skills are all left out."""
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
    """Always lands on a new account, so importing never overwrites a live one."""
    payload = _read_bundle(data)
    if payload is None:
        return None
    account = create(label.strip() or _bundle_label(payload) or "Account")
    path = _ACCOUNTS_DIR / account["id"]
    if _CREDENTIALS_FILE in payload:
        (path / _CREDENTIALS_FILE).write_bytes(payload[_CREDENTIALS_FILE])
    if "settings.json" in payload:
        (path / "settings.json").write_bytes(payload["settings.json"])
    _merge_identity(path / _IDENTITY_FILE, payload.get(_IDENTITY_FILE))
    provider = _bundle_provider(payload)
    if provider:
        meta = {"label": account["label"], "provider": provider}
        (path / _META_FILE).write_text(json.dumps(meta), encoding="utf-8")
        account["provider"] = {"base_url": provider["base_url"], "model": provider.get("model", "")}
    account["logged_in"] = bool(provider) or is_logged_in(account["id"])
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
    before = {key: current.get(key) for key in keys}
    for key in keys:
        if key in primary:
            current[key] = primary[key]
        else:
            current.pop(key, None)
    if target.is_file() and before == {key: current.get(key) for key in keys}:
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, indent=2), encoding="utf-8")


def _mtime(path: Path) -> int:
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return 0


def sync_shared_config(account_id: str) -> None:
    """Overwrite this account's shared keys with the primary's, leaving the rest untouched."""
    path = config_dir(account_id)
    if path is None:
        return
    files = (
        _claude_json(None),
        primary_dir() / "settings.json",
        _claude_json(account_id),
        path / "settings.json",
    )
    if _synced.get(account_id) == tuple(_mtime(item) for item in files):
        return
    _merge_shared(files[0], files[2], _SHARED_KEYS)
    _merge_shared(files[1], files[3], _SHARED_SETTINGS_KEYS)
    _synced[account_id] = tuple(_mtime(item) for item in files)


def sync_all_shared_config() -> None:
    for account in list_accounts():
        if not account["primary"]:
            sync_shared_config(account["id"])
