"""Application configuration loaded from environment variables (.env for local dev)."""

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

PORT = int(os.environ.get("PORT", "8723"))

def _pyproject() -> dict:
    import tomllib
    try:
        with (Path(__file__).resolve().parent.parent / "pyproject.toml").open("rb") as fh:
            return tomllib.load(fh)
    except (OSError, ValueError):
        return {}


_PYPROJECT = _pyproject()
SERVER_VERSION = _PYPROJECT.get("project", {}).get("version", "1.0.0")
SUPPORTED_APP = _PYPROJECT.get("tool", {}).get("cconnect", {}).get("supported-app", ">=1.0.0")
SUPPORTED_CLI = _PYPROJECT.get("tool", {}).get("cconnect", {}).get("supported-cli", ">=0.0.0")

CLAUDE_PROJECTS_DIR = os.environ.get(
    "CLAUDE_PROJECTS_DIR",
    str(Path.home() / ".claude" / "projects"),
)

# Isolated cwd for internal AI helper actions; its throwaway sessions land under a
# separate project key so they never mix into a user's real history.
AI_WORKDIR = os.environ.get("AI_WORKDIR", str(Path(__file__).resolve().parent.parent / "internal_task"))

# Drop folder served download-only to the phone.
SHARED_DIR = str(Path(__file__).resolve().parent.parent / "shared")

# Restart contract between run.py (supervisor) and POST /api/system/restart.
RESTART_EXIT_CODE = 42
RESTART_FLAG = Path(__file__).resolve().parent.parent / ".restart"

# Fallback cwd when the mobile starts a chat without picking a directory and the
# active connection has none. Defaults to the parent of the backend folder.
DEFAULT_CWD = os.environ.get("DEFAULT_CWD", str(Path(__file__).resolve().parent.parent.parent))

# Fallbacks used only if the SDK can't be introspected yet.
_FALLBACK_PERMISSION_MODES = ("default", "acceptEdits", "plan", "dontAsk", "bypassPermissions", "auto")
_FALLBACK_EFFORT_LEVELS = ("low", "medium", "high", "xhigh", "max")

DEFAULT_PERMISSION_MODE = os.environ.get("DEFAULT_PERMISSION_MODE", "bypassPermissions")
DEFAULT_EFFORT = os.environ.get("DEFAULT_EFFORT", "xhigh")

# Pseudo-level surfaced in capabilities; run_prompt expands it to xhigh + the ultracode setting.
ULTRACODE_EFFORT = "ultracode"

# Curated model list (the SDK does not enumerate models). Ids are CLI aliases
# that always resolve to the latest matching model; "default" lets the CLI pick.
MODELS = [
    {"id": "default", "label": "Default"},
    {"id": "fable", "label": "Fable 5"},
    {"id": "fable[1m]", "label": "Fable 5 (1M)"},
    {"id": "opus", "label": "Opus 5"},
    {"id": "opus[1m]", "label": "Opus 5 (1M)"},
    {"id": "sonnet", "label": "Sonnet 5"},
    {"id": "sonnet[1m]", "label": "Sonnet 5 (1M)"},
    {"id": "haiku", "label": "Haiku 4.5"},
]
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "opus[1m]")

# Display labels for permission modes (the SDK only exposes the raw ids). Served with
# capabilities so the app doesn't hardcode/translate them.
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

# Slash commands offered in the composer menu. kind="client" is handled in-app;
# kind="prompt" is forwarded to the CLI; kind="usage" fetches plan usage out-of-band.
# require_confirmation prompts first.
COMMANDS = [
    {"name": "clear", "description": "Clear this conversation", "kind": "client", "require_confirmation": True},
    {"name": "compact", "description": "Compact the conversation", "kind": "prompt"},
    {"name": "context", "description": "Show context window usage", "kind": "prompt"},
    {"name": "usage", "description": "Show plan token usage", "kind": "usage"},
]


def permission_modes() -> tuple[str, ...]:
    """Permission modes from the installed SDK, falling back to a static list."""
    try:
        from typing import get_args
        from claude_agent_sdk.types import PermissionMode
        return tuple(get_args(PermissionMode)) or _FALLBACK_PERMISSION_MODES
    except Exception:
        return _FALLBACK_PERMISSION_MODES


def effort_levels() -> tuple[str, ...]:
    """Effort levels from the installed SDK, falling back to a static list."""
    try:
        from typing import get_args
        from claude_agent_sdk.types import EffortLevel
        return tuple(get_args(EffortLevel)) or _FALLBACK_EFFORT_LEVELS
    except Exception:
        return _FALLBACK_EFFORT_LEVELS


# Pull the latest claude-agent-sdk on startup. Disable for faster dev reloads.
AUTO_UPDATE_SDK = os.environ.get("AUTO_UPDATE_SDK", "1") not in ("0", "false", "False")

# Gated by CCONNECT_AUTH_ACTIVE so a token left in .env from a previous --expose run
# doesn't auth-gate plain `python run.py`.
PUBLIC_ACCESS_TOKEN: str | None = (
    os.environ.get("PUBLIC_ACCESS_TOKEN") if os.environ.get("CCONNECT_AUTH_ACTIVE") == "1" else None
)

__all__ = [
    "PORT",
    "SERVER_VERSION",
    "SUPPORTED_APP",
    "SUPPORTED_CLI",
    "CLAUDE_PROJECTS_DIR",
    "AI_WORKDIR",
    "SHARED_DIR",
    "DEFAULT_CWD",
    "DEFAULT_PERMISSION_MODE",
    "DEFAULT_EFFORT",
    "DEFAULT_MODEL",
    "MODELS",
    "COLORS",
    "permission_modes",
    "effort_levels",
    "AUTO_UPDATE_SDK",
    "PUBLIC_ACCESS_TOKEN",
]
