"""Relocation of the layout that predates the data folder, re-checked on every start."""

import os
import shutil
from contextlib import suppress
from pathlib import Path

from loguru import logger

from core import paths

LEGACY_AI_WORKDIR = paths.BACKEND_DIR / "internal_task"
LEGACY_PROMPTS_DIR = paths.BACKEND_DIR / "prompts"

_KEPT = (
    (paths.BACKEND_DIR / "cconnect.db", paths.DB_FILE),
    (paths.BACKEND_DIR / "cconnect.db-wal", paths.DB_FILE.with_name("cconnect.db-wal")),
    (paths.BACKEND_DIR / "cconnect.db-shm", paths.DB_FILE.with_name("cconnect.db-shm")),
    (paths.BACKEND_DIR / "mcp_disabled.json", paths.MCP_DISABLED_FILE),
    (paths.BACKEND_DIR / "accounts", paths.ACCOUNTS_DIR),
    (LEGACY_PROMPTS_DIR / "USER.md", paths.USER_PROMPT_FILE),
    (LEGACY_PROMPTS_DIR / "projects", paths.PROJECT_PROMPTS_DIR),
    (paths.BACKEND_DIR / "rewind_pending.json", paths.REWIND_FILE),
    (paths.BACKEND_DIR / "session_todos.json", paths.TODOS_FILE),
    (paths.BACKEND_DIR / ".detached.pid", paths.DETACHED_PID_FILE),
    (paths.BACKEND_DIR / ".detached.provider", paths.DETACHED_PROVIDER_FILE),
    (LEGACY_AI_WORKDIR, paths.AI_WORKDIR),
    (paths.BACKEND_DIR / "shared", paths.SHARED_DIR),
    (paths.BACKEND_DIR / "trash", paths.TRASH_DIR),
    (paths.BACKEND_DIR / "logs", paths.LOGS_DIR),
)

_REGENERATED = (
    (paths.BACKEND_DIR / "network_state.json", paths.NETWORK_STATE_FILE),
    (paths.BACKEND_DIR / "context_windows.json", paths.CONTEXT_WINDOWS_FILE),
)

_SPENT = (
    paths.BACKEND_DIR / ".runtime",
    paths.BACKEND_DIR / ".restart",
    paths.BACKEND_DIR / ".browser",
)

_PER_RUN = {".runtime", ".restart", ".stop", ".detached.pid", ".detached.provider"}


def _discard(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    else:
        path.unlink(missing_ok=True)


def _move_file(source: Path, target: Path) -> bool:
    if target.exists():
        logger.warning(f"left {source} in place: {target} already exists")
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.replace(source, target)
    except OSError:
        shutil.copy2(source, target)
        source.unlink()
    return True


def _move_dir(source: Path, target: Path) -> bool:
    """Moves the entries rather than the folder, which a watcher or a running CLI can hold open."""
    target.mkdir(parents=True, exist_ok=True)
    moved = False
    for child in sorted(source.iterdir()):
        destination = target / child.name
        if destination.exists():
            logger.warning(f"left {child} in place: {destination} already exists")
            continue
        os.rename(child, destination)
        moved = True
    with suppress(OSError):
        source.rmdir()
    return moved


def _move(source: Path, target: Path) -> bool:
    if not source.exists():
        return False
    return _move_dir(source, target) if source.is_dir() else _move_file(source, target)


def adopt(source: Path) -> list[str]:
    """Copy another data folder into this one, file by file, keeping both sides intact."""
    taken: list[str] = []
    settings_file = source.parent / paths.ENV_FILE.name
    if settings_file.is_file() and not paths.ENV_FILE.exists():
        paths.ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(settings_file, paths.ENV_FILE)
        taken.append(settings_file.name)
    for item in sorted(source.rglob("*")):
        if item.is_dir() or item.name in _PER_RUN:
            continue
        relative = item.relative_to(source)
        destination = paths.DATA_DIR / relative
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, destination)
        taken.append(relative.as_posix())
    return taken


def migrate() -> list[str]:
    moved = [source.name for source, target in _KEPT if _move(source, target)]
    for source, target in _REGENERATED:
        try:
            if _move(source, target):
                moved.append(source.name)
        except OSError:
            _discard(source)
            _discard(target)
    for path in _SPENT:
        _discard(path)
    return moved
