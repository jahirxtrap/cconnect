"""A plugin's secret options, made the same in every account's secure storage."""

import hashlib
import json
import threading
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from core.db import Session
from core.models import PluginSecretMark
from services import accounts, claude_assets, claude_manage

_lock = threading.Lock()


def _fingerprint(values: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()


def _modified(folder: Path) -> float:
    try:
        return (folder / accounts.CREDENTIALS_FILE).stat().st_mtime
    except OSError:
        return 0.0


def _choice(field: str, current: dict[str, dict], changed: set[str], modified: dict[str, float]) -> Any:
    holders = [name for name, values in current.items() if field in values]
    moved = [name for name in holders if name in changed]
    if moved:
        return current[max(moved, key=modified.__getitem__)][field]
    if len({json.dumps(current[name][field]) for name in holders}) == 1:
        return current[holders[0]][field]
    source = accounts.PRIMARY_STORAGE if accounts.PRIMARY_STORAGE in holders else max(holders, key=modified.__getitem__)
    return current[source][field]


def _marks() -> dict[tuple[str, str], str]:
    with Session() as session:
        return {(row.storage, row.plugin): row.fingerprint for row in session.query(PluginSecretMark)}


def _record(settled: dict[tuple[str, str], str], marks: dict[tuple[str, str], str]) -> None:
    fresh = {key: fingerprint for key, fingerprint in settled.items() if marks.get(key) != fingerprint}
    if not fresh:
        return
    with Session() as session:
        for (storage, plugin), fingerprint in fresh.items():
            session.merge(PluginSecretMark(storage=storage, plugin=plugin, fingerprint=fingerprint, updated_at=datetime.now(timezone.utc)))
        session.commit()


def reconcile() -> None:
    """Gives every account the plugin secrets another one holds, the newest where an account changed one."""
    with _lock, suppress(OSError, SQLAlchemyError):
        storages = accounts.secure_storages()
        held = {name: accounts.stored_plugin_secrets(folder) for name, folder in storages.items()}
        plugins = sorted({plugin for secrets in held.values() for plugin in secrets})
        if not plugins:
            return
        modified = {name: _modified(folder) for name, folder in storages.items()}
        marks = _marks()
        installed: set[str] | None = None
        settled = {}
        for plugin in plugins:
            current = {name: secrets.get(plugin, {}) for name, secrets in held.items()}
            changed = {name for name, values in current.items() if marks.get((name, plugin)) not in (None, _fingerprint(values))}
            fields = sorted({field for values in current.values() for field in values})
            target = {field: _choice(field, current, changed, modified) for field in fields}
            for name, values in current.items():
                lacking = {field: value for field, value in target.items() if values.get(field) != value}
                if lacking:
                    if installed is None:
                        installed = {claude_assets.plugin_id(item) for item in claude_assets.list_plugins()}
                    if plugin not in installed or not claude_manage.configure_secrets(plugin, {key: str(value) for key, value in lacking.items()}, name):
                        continue
                    values = {**values, **{key: str(value) for key, value in lacking.items()}}
                settled[(name, plugin)] = _fingerprint(values)
        _record(settled, marks)


def share(plugin: str, values: dict[str, str]) -> None:
    """Saves the secret options among ``values`` in every account other than the primary one."""
    hidden = {key: value for key, value in values.items() if key in claude_assets.secret_options(plugin)}
    if hidden:
        with _lock:
            for name in accounts.secure_storages():
                if name != accounts.PRIMARY_STORAGE:
                    claude_manage.configure_secrets(plugin, hidden, name)
    reconcile()
