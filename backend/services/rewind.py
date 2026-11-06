"""File/conversation rewind on the CLI's native checkpointing.

Files restore via the ``rewind_files`` control request (dry_run = +/- preview). The
conversation restores via ``--resume-session-at`` on the NEXT turn (it branches the
same transcript), so the chosen anchor stays pending here until that turn runs.
"""

import json
from typing import Any, Optional

from loguru import logger

from core import cli_manager, paths
from services import files

_pending: dict[str, str] | None = None


def _load() -> dict[str, str]:
    global _pending
    if _pending is None:
        try:
            data = json.loads(paths.REWIND_FILE.read_text(encoding="utf-8"))
            _pending = {k: v for k, v in data.items() if isinstance(v, str)} if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            _pending = {}
    return _pending


def _save() -> None:
    try:
        files.write_json(paths.REWIND_FILE, _load())
    except OSError:
        logger.warning("could not persist pending rewinds")


def get_pending(session_id: Optional[str]) -> Optional[str]:
    if not session_id:
        return None
    return _load().get(session_id)


def set_pending(session_id: str, anchor_uuid: str) -> None:
    _load()[session_id] = anchor_uuid
    _save()


def clear_pending(session_id: Optional[str]) -> None:
    if session_id and _load().pop(session_id, None) is not None:
        _save()


async def _rewind_control(cwd: str, session_id: str, user_message_id: str, dry_run: bool) -> dict[str, Any]:
    """The public rewind_files() hides dry_run and the response, so this calls the
    same control channel directly (the TS SDK does expose dryRun)."""
    from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

    options = ClaudeAgentOptions(
        cwd=cwd,
        resume=session_id,
        enable_file_checkpointing=True,
        cli_path=cli_manager.resolve_cli_path(),
        max_turns=1,
        setting_sources=[],
        strict_mcp_config=True,
    )
    async with ClaudeSDKClient(options) as client:
        response = await client._query._send_control_request(
            {"subtype": "rewind_files", "user_message_id": user_message_id, "dry_run": dry_run}
        )
    return response if isinstance(response, dict) else {}


def _normalize(response: dict[str, Any]) -> dict[str, Any]:
    return {
        "can_rewind": bool(response.get("canRewind")),
        "error": response.get("error"),
        "files_changed": response.get("filesChanged") or [],
        "insertions": response.get("insertions") or 0,
        "deletions": response.get("deletions") or 0,
    }


async def preview(cwd: str, session_id: str, user_message_id: str) -> dict[str, Any]:
    try:
        return _normalize(await _rewind_control(cwd, session_id, user_message_id, dry_run=True))
    except Exception as exc:
        logger.error(f"rewind preview failed: {type(exc).__name__}: {exc}")
        return {"can_rewind": False, "error": str(exc), "files_changed": [], "insertions": 0, "deletions": 0}


async def rewind_code(cwd: str, session_id: str, user_message_id: str) -> dict[str, Any]:
    try:
        return _normalize(await _rewind_control(cwd, session_id, user_message_id, dry_run=False))
    except Exception as exc:
        logger.error(f"rewind failed: {type(exc).__name__}: {exc}")
        return {"can_rewind": False, "error": str(exc), "files_changed": [], "insertions": 0, "deletions": 0}
