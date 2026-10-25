import json
import re
import shutil
from typing import Any, Optional

from core import paths

TOOL = "delegate"
TOOL_ID = f"mcp__cconnect__{TOOL}"

KINDS = ("model", "claude", "command", "acp")
REGISTERABLE = ("command", "acp")
SLUG = re.compile(r"[^a-z0-9]+")
TASK_TOKEN = "{task}"
ARG_LISTS = ("args", "edit_args", "bypass_args")

PRESETS = (
    {
        "binary": "codex",
        "kind": "command",
        "name": "Codex",
        "args": ["exec", "--sandbox", "read-only", "-"],
        "edit_args": ["exec", "--sandbox", "workspace-write", "-"],
        "bypass_args": ["exec", "--dangerously-bypass-approvals-and-sandbox", "-"],
    },
    {"binary": "codex-acp", "kind": "acp", "name": "Codex", "args": []},
    {
        "binary": "agy",
        "kind": "command",
        "name": "Antigravity",
        "args": ["-p", TASK_TOKEN],
        "edit_args": ["-p", TASK_TOKEN, "--mode", "accept-edits"],
        "bypass_args": ["-p", TASK_TOKEN, "--dangerously-skip-permissions"],
    },
    {"binary": "copilot", "kind": "acp", "name": "Copilot", "args": ["--acp"]},
    {"binary": "gemini", "kind": "acp", "name": "Gemini", "args": ["--acp"]},
    {"binary": "opencode", "kind": "acp", "name": "opencode", "args": ["acp"]},
    {"binary": "cursor-agent", "kind": "command", "name": "Cursor", "args": ["-p", TASK_TOKEN]},
)


def _strings(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def clean(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    ident = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    kind = raw.get("kind")
    if not ident or not name or kind not in KINDS:
        return None
    return {
        "id": ident,
        "name": name,
        "kind": kind,
        "description": str(raw.get("description") or "").strip(),
        "account": str(raw.get("account") or "").strip() or None,
        "command": str(raw.get("command") or "").strip() or None,
        **{key: _strings(raw.get(key)) for key in ARG_LISTS},
        "enabled": raw.get("enabled") is not False,
    }


def load() -> list[dict]:
    try:
        raw = json.loads(paths.DELEGATES_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    return [entry for entry in map(clean, raw if isinstance(raw, list) else []) if entry]


def save(entries: list[Any]) -> list[dict]:
    cleaned = [entry for entry in map(clean, entries) if entry]
    unique = list({entry["id"]: entry for entry in cleaned}.values())
    paths.DELEGATES_FILE.parent.mkdir(parents=True, exist_ok=True)
    paths.DELEGATES_FILE.write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")
    return unique


def slug(name: str) -> str:
    return SLUG.sub("-", name.lower()).strip("-")


def upsert(entry: dict) -> list[dict]:
    return save([*(item for item in load() if item["id"] != entry["id"]), entry])


def stored(ident: str) -> Optional[dict]:
    return next((entry for entry in load() if entry["id"] == ident), None)


def remove(ident: str) -> Optional[dict]:
    found = stored(ident)
    if found is not None:
        save([item for item in load() if item["id"] != ident])
    return found


def enabled() -> list[dict]:
    return [entry for entry in load() if entry["enabled"]]


def find(ident: str) -> Optional[dict]:
    return next((entry for entry in enabled() if entry["id"] == ident), None)


def label_of(raw_input: Any) -> tuple[Optional[str], Optional[str]]:
    if not isinstance(raw_input, dict):
        return None, None
    if raw_input.get("action") == "register":
        line = " ".join([str(raw_input.get("command") or ""), *map(str, raw_input.get("args") or [])]).strip()
        return raw_input.get("name") or None, line or None
    ident = str(raw_input.get("destination") or "")
    found = stored(ident)
    return (found["name"] if found else ident or None), raw_input.get("task")


def presets() -> list[dict]:
    return [
        {"kind": preset["kind"], "name": preset["name"], "command": found, **{key: preset.get(key, []) for key in ARG_LISTS}}
        for preset in PRESETS
        if (found := shutil.which(preset["binary"]))
    ]
