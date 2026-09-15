"""Every path the backend owns, grouped by what the data is."""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = Path(os.environ.get("CCONNECT_DATA_DIR") or BACKEND_DIR / "data")

CONFIG_DIR = DATA_DIR / "config"
STATE_DIR = DATA_DIR / "state"
CACHE_DIR = DATA_DIR / "cache"
LOGS_DIR = DATA_DIR / "logs"
SHARED_DIR = DATA_DIR / "shared"
TRASH_DIR = DATA_DIR / "trash"

PYPROJECT_FILE = BACKEND_DIR / "pyproject.toml"
PROMPTS_DIR = BACKEND_DIR / "prompts"

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
