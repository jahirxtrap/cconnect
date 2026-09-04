"""The single source of truth for backend-owned settings: which exist, their type, default,
and description. Add a setting here — no DB migration, the KV table is unchanged.

Defaults and descriptions live in code (synced into the DB, never authored there) so they
track app versions; the effective value is always `stored override ?? default here`."""

from dataclasses import dataclass
from typing import Any, Optional

from core.config import DEFAULT_EFFORT, DEFAULT_MODEL, DEFAULT_PERMISSION_MODE


@dataclass(frozen=True)
class SettingDef:
    default: Any
    type: type
    description: str
    allowed: Optional[tuple] = None


_SHOW_MODES = ("full", "label", "off")

SETTINGS: dict[str, SettingDef] = {
    "account": SettingDef(None, str, "Claude account used to run chats"),
    "model": SettingDef(DEFAULT_MODEL, str, "Claude model alias used for chat generation"),
    "effort": SettingDef(DEFAULT_EFFORT, str, "Reasoning effort: low..max, or ultracode (xhigh + workflow orchestration)"),
    "output_style": SettingDef("default", str, "Voice Claude answers in, from the styles the CLI reports"),
    "permission_mode": SettingDef(DEFAULT_PERMISSION_MODE, str, "Default permission mode for new chat sessions"),
    "streaming": SettingDef(True, bool, "Stream tokens (partial messages) as they are generated"),
    "todo_tools": SettingDef(False, bool, "Expose the task-tracking tools, which recent models otherwise omit to save context"),
    "mcp_disabled": SettingDef("", str, "Built-in cconnect MCP tools hidden from Claude, by name and comma separated"),
    "cli_source": SettingDef("system", str, "Which Claude CLI the backend drives: system, custom, or bundled", allowed=("system", "custom", "bundled")),
    "cli_custom_path": SettingDef(None, str, "Filesystem path to the CLI when cli_source is custom"),
    "show_thinking": SettingDef("full", str, "How to show thinking blocks: full, label, or off", allowed=_SHOW_MODES),
    "show_tool_use": SettingDef("label", str, "How to show tool calls: full, label, or off", allowed=_SHOW_MODES),
    "show_file_change": SettingDef("full", str, "How to show file diffs: full, label, or off", allowed=_SHOW_MODES),
    "show_compact": SettingDef("full", str, "How to show compaction blocks: full summary or just a label", allowed=("full", "label")),
    "show_working": SettingDef("label", str, "How to show the quick-chat working indicator: label or off", allowed=("label", "off")),
    "show_tokens": SettingDef(False, bool, "Report how many tokens each thinking block and subagent spent"),
    "simple_mode": SettingDef(False, bool, "Collapse thinking, tools and edits into a single working block, like the quick chat"),
    "chat_order": SettingDef("auto", str, "How chats sort inside their category: by last activity, or as arranged by hand", allowed=("auto", "manual")),
    "trash_enabled": SettingDef(False, bool, "Deleting a chat moves it to a trash it can be restored from, instead of removing it"),
    "terminal_shell": SettingDef(None, str, "Shell executable the terminal spawns; empty uses the platform default"),
    "browser_view": SettingDef(False, bool, "Give Claude a browser in the panel: its own tools plus any CDP client (Playwright, Puppeteer, Selenium), so you see what it does and can take over"),
    "sdk_auto_update": SettingDef(True, bool, "Install the latest Claude Agent SDK every time the server starts"),
    "default_category": SettingDef("", str, "Category a new chat is filed into; empty leaves it out of every category"),
}
