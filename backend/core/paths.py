"""Every path the backend owns, grouped by what the data is."""

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent

INSTALLED = not (BACKEND_DIR / "pyproject.toml").exists()
"""True when imported from a wheel rather than from a source tree."""

HOME_DATA_DIR = Path.home() / ".cconnect" / "data"

DATA_DIR = Path(
    os.environ.get("CCONNECT_DATA_DIR") or (HOME_DATA_DIR if INSTALLED else BACKEND_DIR / "data")
)

CONFIG_DIR = DATA_DIR / "config"
STATE_DIR = DATA_DIR / "state"
LOGS_DIR = DATA_DIR / "logs"
SHARED_DIR = DATA_DIR / "shared"
TRASH_DIR = DATA_DIR / "trash"

CACHE_DIR = Path(os.environ.get("CCONNECT_CACHE_DIR") or DATA_DIR.parent / "cache")

PROMPTS_DIR = PACKAGE_DIR / "prompts"
ENV_FILE = (CONFIG_DIR if INSTALLED else BACKEND_DIR) / ".env"

DB_FILE = CONFIG_DIR / "cconnect.db"
ACCOUNTS_DIR = CONFIG_DIR / "accounts"
MCP_DISABLED_FILE = CONFIG_DIR / "mcp_disabled.json"
USER_PROMPT_FILE = CONFIG_DIR / "prompts" / "USER.md"
COMMIT_PROMPT_FILE = CONFIG_DIR / "prompts" / "COMMIT.md"
PROJECT_PROMPTS_DIR = CONFIG_DIR / "prompts" / "projects"

RUNTIME_FILE = STATE_DIR / ".runtime"
RESTART_FLAG = STATE_DIR / ".restart"
STOP_FLAG = STATE_DIR / ".stop"
DETACHED_PID_FILE = STATE_DIR / ".detached.pid"
DETACHED_PROVIDER_FILE = STATE_DIR / ".detached.provider"
REWIND_FILE = STATE_DIR / "rewind_pending.json"
TODOS_FILE = STATE_DIR / "session_todos.json"
AI_WORKDIR = Path(os.environ.get("AI_WORKDIR") or STATE_DIR / "internal_task")

NETWORK_STATE_FILE = CACHE_DIR / "network_state.json"
CONTEXT_WINDOWS_FILE = CACHE_DIR / "context_windows.json"
BROWSER_PROFILE_DIR = Path(os.environ.get("BROWSER_PROFILE_DIR") or CACHE_DIR / "browser")

SERVER_LOG_FILE = LOGS_DIR / "server.jsonl"
DETACHED_LOG_FILE = LOGS_DIR / "detached.log"

OWNED_DIRS = (
    CONFIG_DIR,
    STATE_DIR,
    CACHE_DIR,
    LOGS_DIR,
    SHARED_DIR,
    TRASH_DIR,
    PROJECT_PROMPTS_DIR,
    AI_WORKDIR,
)


def ensure_dirs() -> None:
    for directory in OWNED_DIRS:
        directory.mkdir(parents=True, exist_ok=True)


ensure_dirs()
