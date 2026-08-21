"""Selectable Claude Code CLI: which binary the SDK drives (system / custom / bundled).

The SDK defaults to its bundled claude.exe, which may lag the CLI the user already has
on PATH. This lets the phone point CConnect at the system CLI (newer, carries features
like ultracode), a custom path, or the bundled one, and update the system CLI in place."""

import platform
import shutil
import re
import subprocess
import time
from pathlib import Path
from typing import Optional

from core.settings_defs import SETTINGS
from services import settings_store

# Same fallback locations the SDK's own _find_cli scans after PATH, using the
# platform-correct binary name (claude.exe on Windows, claude elsewhere).
_CLI_NAME = "claude.exe" if platform.system() == "Windows" else "claude"
_KNOWN_LOCATIONS = (
    Path.home() / ".local/bin" / _CLI_NAME,
    Path.home() / ".npm-global/bin" / _CLI_NAME,
    Path("/usr/local/bin") / _CLI_NAME,
    Path.home() / "node_modules/.bin" / _CLI_NAME,
)


def get_source() -> str:
    return settings_store.get("cli_source")


def get_custom_path() -> Optional[str]:
    return settings_store.get("cli_custom_path")


def system_cli() -> Optional[str]:
    """The CLI the user runs in their own terminal (PATH first, then known spots)."""
    if found := shutil.which("claude"):
        return found
    for path in _KNOWN_LOCATIONS:
        if path.exists() and path.is_file():
            return str(path)
    return None


def bundled_version() -> Optional[str]:
    try:
        from claude_agent_sdk._cli_version import __cli_version__
        return __cli_version__
    except Exception:
        return None


def resolve_cli_path(source: Optional[str] = None, custom_path: Optional[str] = None) -> Optional[str]:
    """Path to pass as ClaudeAgentOptions.cli_path. None = let the SDK use its bundled CLI.

    Pass source/custom_path to resolve a specific (unsaved) selection instead of the stored one."""
    src = source or get_source()
    if src == "custom":
        path = custom_path if custom_path is not None else get_custom_path()
        return path if path and Path(path).exists() else None
    if src == "system":
        return system_cli()
    return None


def cli_version(path: Optional[str]) -> Optional[str]:
    """Run `<cli> -v` and return the version string. None when it can't be queried."""
    if not path:
        return None
    try:
        result = subprocess.run([path, "-v"], capture_output=True, text=True, timeout=15)
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() or None


_version_cache: Optional[tuple[Optional[str], Optional[str]]] = None


def active_version() -> Optional[str]:
    global _version_cache
    resolved = resolve_cli_path()
    if _version_cache is not None and _version_cache[0] == resolved:
        return _version_cache[1]
    raw = cli_version(resolved) if resolved else bundled_version()
    match = re.search(r"\d+(?:\.\d+)+", raw or "")
    version = match.group() if match else None
    _version_cache = (resolved, version)
    return version


def invalidate_version_cache() -> None:
    global _version_cache
    _version_cache = None


def _settled_version(path: str, before: Optional[str], deadline: float = 5.0) -> Optional[str]:
    """`claude update` returns before the new binary is in place, so asking once
    right after still reports the old version. Wait briefly for it to change."""
    end = time.monotonic() + deadline
    version = cli_version(path)
    while version == before and time.monotonic() < end:
        time.sleep(0.5)
        version = cli_version(path)
    return version


def update_cli(source: Optional[str] = None, custom_path: Optional[str] = None) -> dict:
    """Self-update the resolved CLI in place (`claude update`). Bundled can't update.

    Updates the given (unsaved) selection when provided, otherwise the stored source."""
    src = source or get_source()
    if src == "bundled":
        return {"ok": False, "message": "The bundled CLI can't be updated; switch to system."}
    path = resolve_cli_path(source, custom_path)
    if not path:
        return {"ok": False, "message": "No CLI resolved for the current source."}
    before = cli_version(path)
    try:
        result = subprocess.run([path, "update"], capture_output=True, text=True, timeout=180)
    except (OSError, subprocess.SubprocessError) as exc:
        return {"ok": False, "message": str(exc)}
    version = _settled_version(path, before) if result.returncode == 0 else cli_version(path)
    invalidate_version_cache()
    output = (result.stdout + result.stderr).strip()
    return {"ok": result.returncode == 0, "message": output, "version": version}


def set_source(source: str, custom_path: Optional[str] = None) -> None:
    if source == "custom" and not (custom_path and Path(custom_path).exists()):
        raise ValueError("custom source requires an existing path")
    settings_store.set("cli_source", source)  # validates against the registry's allowed set
    settings_store.set("cli_custom_path", custom_path)
    invalidate_version_cache()


def status() -> dict:
    source = get_source()
    resolved = resolve_cli_path()
    system = system_cli()
    return {
        "source": source,
        "sources": list(SETTINGS["cli_source"].allowed or ()),
        "resolved_path": resolved,
        "active_version": cli_version(resolved) if resolved else bundled_version(),
        "bundled_version": bundled_version(),
        "system_path": system,
        "system_version": cli_version(system),
        "custom_path": get_custom_path(),
    }
