"""Application configuration loaded from environment variables (.env for local dev)."""

import os
from pathlib import Path

from core import paths, release

try:
    from dotenv import load_dotenv
    load_dotenv(paths.ENV_FILE)
except ImportError:
    pass

PORT = int(os.environ.get("PORT", "8723"))
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")

SHARED_SCHEME = "cconnect://shared"

SERVER_VERSION = release.VERSION
SUPPORTED_APP = release.SUPPORTED_APP
SUPPORTED_CLI = release.SUPPORTED_CLI

CLAUDE_PROJECTS_DIR = os.environ.get(
    "CLAUDE_PROJECTS_DIR",
    str(Path.home() / ".claude" / "projects"),
)

# Restart contract between run.py (supervisor) and POST /api/system/restart.
RESTART_EXIT_CODE = 42

# Fallback cwd when the mobile starts a chat without picking a directory and the
# active connection has none. The parent of a checkout, home when installed.
DEFAULT_CWD = os.environ.get(
    "DEFAULT_CWD", str(Path.home() if paths.INSTALLED else paths.BACKEND_DIR.parent)
)

# Fallback used only if the SDK can't be introspected yet.
_FALLBACK_PERMISSION_MODES = ("default", "acceptEdits", "plan", "dontAsk", "bypassPermissions", "auto")

DEFAULT_PERMISSION_MODE = os.environ.get("DEFAULT_PERMISSION_MODE", "bypassPermissions")
FALLBACK_PERMISSION_MODE = "auto"

_RUNNING_AS_ROOT = getattr(os, "geteuid", lambda: -1)() == 0
DEFAULT_EFFORT = os.environ.get("DEFAULT_EFFORT", "xhigh")

# Pseudo-level surfaced in capabilities; run_prompt expands it to xhigh + the ultracode setting.
ULTRACODE_EFFORT = "ultracode"

DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "opus[1m]")

REQUEST_LIMIT_BYTES = 32 * 1024 * 1024

# Display labels for permission modes (the SDK only exposes the raw ids).
PERMISSION_LABELS = {
    "default": "Default",
    "acceptEdits": "Accept edits",
    "plan": "Plan",
    "bypassPermissions": "Bypass",
    "dontAsk": "Don't ask",
    "auto": "Auto",
}

# The named set Claude uses for agent colors; the app maps each to a swatch.
COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"]

# Slash commands CConnect handles itself. kind="client" is handled in-app; kind="prompt"
# is forwarded to the CLI; kind="usage" fetches plan usage out-of-band. require_confirmation
# prompts first. own_description keeps ours when the CLI describes a behaviour we changed.
# Everything else the CLI reports is appended as kind="prompt" (see services/cli_info).
COMMANDS = [
    {"name": "clear", "description": "Clear this conversation", "kind": "client",
     "require_confirmation": True, "own_description": True},
    {"name": "compact", "description": "Compact the conversation", "kind": "prompt"},
    {"name": "context", "description": "Show context window usage", "kind": "prompt"},
    {"name": "usage", "description": "Show plan token usage", "kind": "usage"},
]


def permission_modes() -> tuple[str, ...]:
    """Permission modes from the installed SDK, minus the ones this process cannot use."""
    try:
        from typing import get_args
        from claude_agent_sdk.types import PermissionMode
        modes = tuple(get_args(PermissionMode)) or _FALLBACK_PERMISSION_MODES
    except Exception:
        modes = _FALLBACK_PERMISSION_MODES
    if _RUNNING_AS_ROOT:
        return tuple(mode for mode in modes if mode != "bypassPermissions")
    return modes


def resolve_permission_mode(mode: str | None) -> str:
    return mode if mode in permission_modes() else FALLBACK_PERMISSION_MODE


# Gated by CCONNECT_AUTH_ACTIVE so a token left in .env from a previous --expose run
# doesn't auth-gate plain `python run.py`.
PUBLIC_ACCESS_TOKEN: str | None = (
    os.environ.get("PUBLIC_ACCESS_TOKEN") if os.environ.get("CCONNECT_AUTH_ACTIVE") == "1" else None
)

SECURITY_KEY: str | None = os.environ.get("SECURITY_KEY") or None

# Chromium driven over CDP for the browser pane. Its own profile, so it never touches
# the user's real one, and a debug port of its own so it can coexist with other tooling.
BROWSER_EXECUTABLE = os.environ.get("BROWSER_EXECUTABLE", "")
BROWSER_DEBUG_PORT = int(os.environ.get("BROWSER_DEBUG_PORT", "9333"))
BROWSER_HEADLESS = os.environ.get("BROWSER_HEADLESS", "1") not in ("0", "false", "False")
BROWSER_QUALITY = max(20, min(95, int(os.environ.get("BROWSER_QUALITY", "70"))))

__all__ = [
    "PORT",
    "SERVER_VERSION",
    "SUPPORTED_APP",
    "SUPPORTED_CLI",
    "CLAUDE_PROJECTS_DIR",
    "DEFAULT_CWD",
    "DEFAULT_PERMISSION_MODE",
    "FALLBACK_PERMISSION_MODE",
    "resolve_permission_mode",
    "DEFAULT_EFFORT",
    "DEFAULT_MODEL",
    "COLORS",
    "permission_modes",
    "PUBLIC_ACCESS_TOKEN",
    "SECURITY_KEY",
    "BROWSER_EXECUTABLE",
    "BROWSER_DEBUG_PORT",
    "BROWSER_HEADLESS",
    "BROWSER_QUALITY",
]
