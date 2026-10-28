"""Read Claude Code projects and session transcripts from ~/.claude/projects."""

import asyncio
import json
import os
import re
import shutil
import time
from pathlib import Path
from textwrap import dedent
from typing import Any, Optional

from core import data_migration, paths
from core.config import CLAUDE_PROJECTS_DIR
from services import delegate_runs, delegates, mods, prompt_cache, settings_store, tool_calls, visibility
from services.api_errors import api_error
from services.questions import DECLINE_MARK, DISMISS, SUBMIT_KEY, questions_to_blocks, values_from_answers

_KEY_RE = re.compile(r"^[A-Za-z0-9._-]+$")
_SESSION_RE = re.compile(r"^[A-Za-z0-9._-]+$")

_ASK_ANSWERS_RE = re.compile(r'"([^"]+)"="([^"]*)"')

_COMMAND_META_RE = re.compile(r"<command-(name|message|args)>|<local-command-stdout>")
_COMMAND_NAME_RE = re.compile(r"<command-name>\s*([^<]+?)\s*</command-name>")
_COMPACT_MARK = b'"compact_boundary"'
_INTERRUPT_RE = re.compile(r"^\[Request interrupted by user")

_SDK_ENTRYPOINT_RE = re.compile(rb'"entrypoint":"sdk-[A-Za-z]+"')
_CLI_ENTRYPOINT = b'"entrypoint":"cli"'

_TRAVELLING_TYPES = {"user", "assistant"}
_MEDIA_TYPES = {"image", "document"}
_request_totals: dict[str, tuple[int, int, int, int]] = {}


def _base() -> Path:
    return Path(CLAUDE_PROJECTS_DIR)


def record_prompt_history(cwd: str, session_id: str, text: str):
    if not session_id:
        return
    path = _base().parent / "history.jsonl"
    entry = {
        "display": text,
        "pastedContents": {},
        "timestamp": int(time.time() * 1000),
        "project": cwd,
        "sessionId": session_id,
    }
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def project_key_for(cwd: str) -> str:
    from claude_agent_sdk import project_key_for_directory

    return project_key_for_directory(cwd) if cwd else ""


_AI_PROJECT_KEYS = {
    project_key_for(str(path))
    for path in (paths.AI_WORKDIR, data_migration.LEGACY_AI_WORKDIR)
}


def _open_transcript(path: Path, mode: str):
    """Open a transcript so its bytes and line endings survive a rewrite untouched."""
    return path.open(mode, encoding="utf-8", errors="surrogateescape", newline="")


def normalize_session_entrypoint(cwd: str, session_id: str, start: int = 0):
    if not _SESSION_RE.match(session_id or ""):
        return
    normalize_entrypoint(_base() / project_key_for(cwd) / f"{session_id}.jsonl", start)


def normalize_entrypoint(path: Path, start: int = 0):
    """Rewrite the SDK's "sdk-*" entrypoint to "cli" in place, from `start` on; `claude --resume` hides sdk sessions."""
    if not path.is_file():
        return
    with path.open("r+b") as fh:
        fh.seek(start)
        offset = start
        found: list[tuple[int, int]] = []
        for raw in fh:
            if not raw.endswith(b"\n"):
                break
            found.extend((offset + match.start(), match.end() - match.start()) for match in _SDK_ENTRYPOINT_RE.finditer(raw))
            offset += len(raw)
        for at, width in found:
            fh.seek(at)
            fh.write(_CLI_ENTRYPOINT.ljust(width))


def _project_dir(project_key: str) -> Path:
    if not _KEY_RE.match(project_key):
        raise ValueError("invalid project key")
    path = (_base() / project_key).resolve()
    if _base().resolve() not in path.parents and path != _base().resolve():
        raise ValueError("project key escapes the projects directory")
    return path


def _session_file(project_key: str, session_id: str, trashed: bool = False) -> Path:
    if not _SESSION_RE.match(session_id):
        raise ValueError("invalid session id")
    directory = _trash_dir(project_key) if trashed else _project_dir(project_key)
    path = (directory / f"{session_id}.jsonl").resolve()
    if path.parent != directory:
        raise ValueError("session id escapes the project directory")
    return path


def _trash_dir(project_key: str) -> Path:
    from services.trash import trash_root

    if not _KEY_RE.match(project_key):
        raise ValueError("invalid project key")
    root = trash_root()
    path = (root / project_key).resolve()
    if root.resolve() not in path.parents:
        raise ValueError("project key escapes the trash directory")
    return path


def _iter_lines(path: Path, offset: int = 0):
    with path.open("rb") as fh:
        if offset:
            fh.seek(offset)
        for raw in fh:
            line = raw.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue


def _last_compact_offset(path: Path, block: int = 1 << 20) -> int:
    try:
        size = path.stat().st_size
        with path.open("rb") as fh:
            pos = size
            tail = b""
            while pos > 0:
                step = min(block, pos)
                pos -= step
                fh.seek(pos)
                chunk = fh.read(step) + tail
                found = chunk.rfind(_COMPACT_MARK)
                if found != -1:
                    start = chunk.rfind(b"\n", 0, found)
                    return pos + start + 1 if start != -1 else pos
                tail = chunk[: len(_COMPACT_MARK)]
    except OSError:
        return 0
    return 0


def transcript_stamp(project_key: str, session_id: str) -> Optional[tuple[int, int]]:
    try:
        stat = _session_file(project_key, session_id).stat()
    except (ValueError, OSError):
        return None
    return (stat.st_mtime_ns, stat.st_size)


def _tail_entries(project_key: str, session_id: str, trashed: bool) -> list[dict]:
    try:
        file = _session_file(project_key, session_id, trashed)
    except ValueError:
        return []
    if not file.is_file():
        return []
    try:
        with file.open("rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            fh.seek(max(0, size - 131072))
            chunk = fh.read().decode("utf-8", errors="ignore")
    except OSError:
        return []
    entries = []
    for line in chunk.splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(entry, dict):
            entries.append(entry)
    return entries


def last_context_tokens(project_key: str, session_id: str, trashed: bool = False) -> Optional[int]:
    for entry in reversed(_tail_entries(project_key, session_id, trashed)):
        msg = entry.get("message")
        usage = msg.get("usage") if isinstance(msg, dict) else None
        if isinstance(usage, dict):
            return prompt_cache.input_tokens(usage) or None
    return None


def last_prompt_cache(project_key: str, session_id: str, trashed: bool = False) -> Optional[dict]:
    return prompt_cache.from_entries(_tail_entries(project_key, session_id, trashed))


def _block_media_bytes(block: Any) -> int:
    if not isinstance(block, dict):
        return 0
    if block.get("type") in _MEDIA_TYPES:
        return len(json.dumps(block))
    if block.get("type") == "tool_result" and isinstance(block.get("content"), list):
        return sum(_block_media_bytes(item) for item in block["content"])
    return 0


def _entry_weight(entry: dict) -> tuple[int, int]:
    if entry.get("type") not in _TRAVELLING_TYPES or entry.get("isSidechain"):
        return 0, 0
    message = entry.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        return len(content), 0
    if isinstance(content, list):
        return len(json.dumps(content)), sum(_block_media_bytes(block) for block in content)
    return 0, 0


def request_weight(project_key: str, session_id: str, trashed: bool = False) -> Optional[tuple[int, int]]:
    """Bytes the next request carries, total and the media part of it."""
    try:
        file = _session_file(project_key, session_id, trashed)
    except ValueError:
        return None
    if not file.is_file():
        return None
    start = _last_compact_offset(file)
    key = str(file)
    base, offset, total, media = _request_totals.get(key, (start, start, 0, 0))
    try:
        if base != start or not start <= offset <= file.stat().st_size:
            offset, total, media = start, 0, 0
        with file.open("rb") as fh:
            fh.seek(offset)
            for raw in fh:
                if not raw.endswith(b"\n"):
                    break
                offset += len(raw)
                try:
                    entry = json.loads(raw)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                weight, media_weight = _entry_weight(entry)
                total += weight
                media += media_weight
    except OSError:
        return None
    _request_totals[key] = (start, offset, total, media)
    return total, media


def session_size(project_key: str, session_id: str) -> int:
    try:
        return _session_file(project_key, session_id).stat().st_size
    except (ValueError, OSError):
        return 0


def user_messages_since(project_key: str, session_id: str, offset: int) -> tuple[list[dict], int]:
    """The user rows in the complete lines written past `offset`, and the offset those lines end at."""
    try:
        file = _session_file(project_key, session_id)
        if offset > file.stat().st_size:
            offset = 0
        out: list[dict] = []
        with file.open("rb") as fh:
            fh.seek(offset)
            for raw in fh:
                if not raw.endswith(b"\n"):
                    break
                offset += len(raw)
                if b'"type":"user"' not in raw and b'"queued_command"' not in raw:
                    continue
                try:
                    row = _user_row(json.loads(raw))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if row is not None:
                    out.append(row)
    except (ValueError, OSError):
        return [], offset
    return out, offset


def _user_row(entry: dict) -> Optional[dict]:
    etype = entry.get("type")
    source = None
    if etype == "attachment":
        att = entry.get("attachment") or {}
        if att.get("type") != "queued_command":
            return None
        text = _text_from_content(att.get("prompt")).strip()
        source = att.get("source_uuid")
    elif etype != "user" or entry.get("isMeta") or entry.get("isSidechain") or entry.get("isCompactSummary") or entry.get("isVisibleInTranscriptOnly"):
        return None
    else:
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, str):
            text = content.strip()
        elif isinstance(content, list):
            if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                return None
            text = "\n".join(
                b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
            ).strip()
        else:
            return None
    uid = entry.get("uuid")
    if not uid or not text or _COMMAND_META_RE.search(text) or _INTERRUPT_RE.match(text):
        return None
    return {"uuid": uid, "text": text, "ts": _parse_ts(entry.get("timestamp")), "source": source}


def _text_from_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                parts.append(block.get("text", ""))
            elif btype == "tool_use":
                parts.append(f"[tool: {block.get('name', '')}]")
            elif btype == "tool_result":
                parts.append("[tool result]")
        return "\n".join(p for p in parts if p)
    return ""


def _read_cwd(path: Path) -> Optional[str]:
    for entry in _iter_lines(path):
        cwd = entry.get("cwd")
        if cwd:
            return cwd
    return None


_META_WINDOW = 256 * 1024


def _tail_offset(path: Path, window: int) -> int:
    try:
        size = path.stat().st_size
        if size <= window:
            return 0
        with path.open("rb") as fh:
            fh.seek(size - window)
            fh.readline()
            return fh.tell()
    except OSError:
        return 0


def _meta_entries(path: Path):
    size = path.stat().st_size
    with path.open("rb") as fh:
        head = fh.read(_META_WINDOW)
        cut = len(head)
        if len(head) == _META_WINDOW:
            head, _, partial = head.rpartition(b"\n")
            cut -= len(partial)
        tail = b""
        if size > cut:
            start = max(cut, size - _META_WINDOW)
            fh.seek(start)
            tail = fh.read()
            if start > cut:
                tail = tail.partition(b"\n")[2]
    for raw in head.splitlines() + tail.splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue


def _session_meta(path: Path) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str], bool]:
    """Single pass over a transcript: (cwd, first-user preview, title, color, entrypoint,
    has_content). Title prefers the user's `custom-title`, falling back to the CLI's
    `ai-title`. Color is the CLI's `agent-color`. has_content is False when the only user
    entries are local-command invocations (e.g. running `/effort` alone), which would
    otherwise list with a `<command-...>` preview and open empty."""
    cwd = preview = title = ai_title = color = entrypoint = None
    has_content = False
    for entry in _meta_entries(path):
        etype = entry.get("type")
        if cwd is None and entry.get("cwd"):
            cwd = entry.get("cwd")
        if entrypoint is None and entry.get("entrypoint"):
            entrypoint = entry.get("entrypoint")
        if etype == "custom-title":
            title = entry.get("customTitle") or None
        elif etype == "ai-title" and entry.get("aiTitle"):
            ai_title = entry.get("aiTitle")
        elif etype == "agent-color":
            color = entry.get("agentColor") or None
        elif etype == "user" and not entry.get("isMeta") and not entry.get("isSidechain"):
            text = _text_from_content(entry.get("message", {}).get("content"))
            if not _COMMAND_META_RE.search(text):
                has_content = True
                if preview is None and text:
                    preview = text[:120]
    return cwd, preview, title or ai_title, color, entrypoint, has_content


def _project_name(path: str | None) -> str | None:
    if not path:
        return None
    return path.replace("\\", "/").rstrip("/").rsplit("/", 1)[-1] or None


def _write_title(project_key: str, session_id: str, title: str) -> Optional[str]:
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return None
    safe = title.replace("\n", " ").strip()[:80]
    _pin_meta(session_id, "custom-title", safe)
    _append_entry(file, _meta_entry("custom-title", safe, session_id))
    _append_entry(file, _meta_entry("agent-name", safe, session_id))
    return safe


async def rename_session(project_key: str, session_id: str, title: str) -> bool:
    """Set the session's display title (the `custom-title`/`agent-name` entries the
    CLI uses), so it shows renamed in the picker and the app history."""
    from services.live_sessions import registry

    safe = await asyncio.to_thread(_write_title, project_key, session_id, title)
    if safe is None:
        return False
    live = registry.get_by_session(session_id)
    if live is not None:
        await live.rename(safe)
    return True


def _append_entry(file: Path, entry: dict) -> None:
    """Append a metadata entry without moving the transcript's mtime."""
    try:
        stat = file.stat()
    except OSError:
        stat = None
    with file.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    if stat is not None:
        os.utime(file, (stat.st_atime, stat.st_mtime))


def set_session_color(project_key: str, session_id: str, color: str) -> bool:
    """Set the conversation accent the CLI shows, via its `agent-color` entry (the
    same one `claude --resume` reads). Empty color clears it."""
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return False
    _pin_meta(session_id, "agent-color", color)
    _append_entry(file, _meta_entry("agent-color", color, session_id))
    return True


_META_FIELD = {"custom-title": "customTitle", "agent-name": "agentName", "agent-color": "agentColor"}
_PINNED_FIELD = {"custom-title": "title", "agent-color": "color"}
_pinned: dict[str, dict[str, str]] = {}


def _meta_entry(etype: str, value: str, session_id: str) -> dict:
    return {"type": etype, _META_FIELD[etype]: value, "sessionId": session_id}


def _pin_meta(session_id: str, etype: str, value: str) -> None:
    if session_id:
        _pinned.setdefault(session_id, {})[etype] = value


def reassert_meta(project_key: str, session_id: str) -> None:
    pinned = _pinned.get(session_id)
    if not pinned:
        return
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return
    _, _, title, color, _, _ = _session_meta(file)
    current = {"custom-title": title or "", "agent-color": color or ""}
    for etype, value in pinned.items():
        if current.get(etype) != value:
            _append_entry(file, _meta_entry(etype, value, session_id))


def with_pinned(session_id: str, meta: dict) -> dict:
    pinned = _pinned.get(session_id)
    if not pinned:
        return meta
    return {**meta, **{_PINNED_FIELD[etype]: value or None for etype, value in pinned.items()}}


def forget_pinned(session_id: str) -> None:
    _pinned.pop(session_id, None)



def _transcript_for_title(path: Path, max_chars: int = 2000) -> str:
    parts: list[str] = []
    for entry in _iter_lines(path, max(_last_compact_offset(path), _tail_offset(path, 1 << 20))):
        if entry.get("type") not in _TRAVELLING_TYPES:
            continue
        text = _text_from_content(entry.get("message", {}).get("content"))
        if not text:
            continue
        parts.append(f"{entry.get('type')}: {text[:600]}")
    selected: list[str] = []
    total = 0
    for chunk in reversed(parts):
        if selected and total + len(chunk) > max_chars:
            break
        selected.append(chunk)
        total += len(chunk)
    selected.reverse()
    return "\n".join(selected)[:max_chars]


async def auto_generate_title(project_key: str, session_id: str, account: str = "") -> Optional[str]:
    """Get a short title from the model, then do the rename ourselves (the model only
    returns the text)."""
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return None
    transcript = _transcript_for_title(file)
    if not transcript:
        return None
    from services.chat_list import hub
    from services.claude_runtime import generate_title

    hub.set_activity(session_id, "renaming")
    try:
        raw = await generate_title(transcript, account)
        title = raw.replace("\n", " ").strip().strip("\"'").strip().rstrip(".")[:80]
        if not title:
            return None
        await rename_session(project_key, session_id, title)
        return title
    finally:
        await hub.settle_activity(session_id)


def delete_session(project_key: str, session_id: str) -> bool:
    from services import categories, trash

    file = _session_file(project_key, session_id)
    if not file.is_file():
        return False
    if trash.enabled():
        _, _, title, _, _, _ = _session_meta(file)
        placement = categories.placement_of(session_id) or {}
        trash.store(
            project_key,
            session_id,
            file,
            title,
            _read_cwd(file),
            placement.get("category_id"),
            placement.get("position"),
        )
    else:
        file.unlink()
        extras = file.parent / session_id
        if extras.is_dir():
            shutil.rmtree(extras, ignore_errors=True)
        delegate_runs.forget(session_id)
    forget_pinned(session_id)
    categories.forget_session(session_id)
    return True


async def discard_sessions(project_key: str, session_ids: list[str]) -> list[str]:
    from services.chat_list import hub
    from services.live_sessions import registry

    for session_id in session_ids:
        hub.hide(session_id)
    try:
        await asyncio.gather(*(registry.end_session(session_id) for session_id in session_ids))
        return [
            session_id for session_id in session_ids
            if await asyncio.to_thread(delete_session, project_key, session_id)
        ]
    finally:
        await hub.unhide(*session_ids)


async def discard_session(project_key: str, session_id: str) -> bool:
    return bool(await discard_sessions(project_key, [session_id]))


async def discard_project(project_key: str) -> Optional[list[str]]:
    """Delete a project directory and every chat in it, returning the ids that were removed."""
    directory = _project_dir(project_key)
    if not directory.is_dir():
        return None
    removed = await discard_sessions(project_key, [file.stem for file in directory.glob("*.jsonl")])
    await asyncio.to_thread(shutil.rmtree, directory, True)
    return removed


def _rewrite_cwd(source: Path, target: Path, cwd: str) -> None:
    """Copy a transcript to `target`, rewriting only the cwd of the entries that carry one."""
    with _open_transcript(source, "r") as src, _open_transcript(target, "w") as dst:
        for line in src:
            body = line.rstrip("\r\n")
            ending = line[len(body):]
            if not body.strip():
                dst.write(line)
                continue
            try:
                entry = json.loads(body)
            except (json.JSONDecodeError, UnicodeDecodeError):
                dst.write(line)
                continue
            if isinstance(entry, dict) and entry.get("cwd") and entry["cwd"] != cwd:
                entry["cwd"] = cwd
                dst.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + ending)
            else:
                dst.write(line)


def move_session(project_key: str, session_id: str, target_cwd: str) -> Optional[str]:
    """Move a session to the project that owns `target_cwd`, returning the new project key."""
    from services.live_sessions import registry

    target_cwd = (target_cwd or "").strip()
    if not target_cwd:
        raise ValueError("target cwd is required")
    target_key = project_key_for(target_cwd)
    if target_key == project_key:
        raise ValueError("the session is already in that project")
    source = _session_file(project_key, session_id)
    if not source.is_file():
        return None
    live = registry.get_by_session(session_id)
    if live is not None and live.running:
        raise RuntimeError("a turn is running in this session")
    target_dir = _project_dir(target_key)
    target_dir.mkdir(parents=True, exist_ok=True)
    target = _session_file(target_key, session_id)
    if target.exists():
        raise ValueError("the target project already has a session with this id")
    source_extras = source.parent / session_id
    target_extras = target_dir / session_id
    if source_extras.is_dir() and target_extras.exists():
        raise ValueError("the target project already has data for this session")
    staged = target_dir / f".{session_id}.jsonl.moving"
    try:
        _rewrite_cwd(source, staged, target_cwd)
        os.replace(staged, target)
    except BaseException:
        staged.unlink(missing_ok=True)
        raise
    if source_extras.is_dir():
        os.replace(source_extras, target_extras)
    source.unlink()
    return target_key


def find_session_cwd(session_id: str) -> Optional[str]:
    """The cwd a transcript records, looked up wherever it lives."""
    if not session_id or "/" in session_id or "\\" in session_id:
        return None
    base = _base()
    if not base.is_dir():
        return None
    for directory in base.iterdir():
        if not directory.is_dir():
            continue
        file = directory / f"{session_id}.jsonl"
        if file.is_file():
            return _read_cwd(file)
    return None


def session_cwd(project_key: str, session_id: str) -> Optional[str]:
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return None
    return _read_cwd(file)


def _parse_ask_result(content: object, qtexts: list[str]) -> dict[str, tuple[str, str]]:
    """Parse an AskUserQuestion tool_result into {question: (answer, note)}."""
    from services.claude_runtime import _flatten_result_content
    text = _flatten_result_content(content)
    marks = sorted((text.find(f'"{qt}"='), qt) for qt in qtexts if f'"{qt}"=' in text)
    out: dict[str, tuple[str, str]] = {}
    for i, (start, qt) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        seg = text[start:end]
        am = re.match(r'"(?:[^"]*)"=(?:"([^"]*)"|\(no option selected\))', seg)
        answer = (am.group(1) or "") if am else ""
        note = ""
        nm = re.search(r"\bnotes:\s*(.*)", seg, re.S)
        if nm:
            note = re.sub(r"\.\s*You can now continue.*$", "", nm.group(1), flags=re.S).strip()
            note = re.sub(r",\s*$", "", note)
        out[qt] = (answer, note)
    return out


def _parse_component_result(content: object) -> Optional[dict]:
    """The answered values of an ask_component tool_result, or None when it never got answered."""
    if content is None:
        return None
    from services.claude_runtime import _flatten_result_content
    try:
        payload = json.loads(_flatten_result_content(content))
    except ValueError:
        return None
    if not isinstance(payload, dict):
        return None
    values = payload.get("values")
    return {
        "dismissed": not payload.get("submitted"),
        "dismissed_by": payload.get("dismissed_by"),
        "values": values if isinstance(values, dict) and payload.get("submitted") else {},
    }


def _compact_summary_text(entry: dict) -> str:
    """The recap text from an isCompactSummary user entry (string or text blocks)."""
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
        return "\n".join(p for p in parts if p).strip()
    return ""


def compact_boundary_count(cwd: str, session_id: str) -> int:
    """How many compaction boundaries the transcript holds; comparing before/after a turn
    tells whether a manual /compact actually compacted (it emits no live boundary event)."""
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return 0
    if not file.is_file():
        return 0
    return sum(
        1 for e in _iter_lines(file)
        if e.get("type") == "system" and e.get("subtype") == "compact_boundary"
    )


def local_command_count(cwd: str, session_id: str) -> int:
    """Count of local-command outputs in the transcript; compare before/after a turn to detect a new one."""
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return 0
    if not file.is_file():
        return 0
    return sum(
        1 for e in _iter_lines(file)
        if e.get("type") == "system" and e.get("subtype") == "local_command"
    )


def latest_local_command(cwd: str, session_id: str) -> Optional[str]:
    """Markdown body of the most recent local-command output."""
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return None
    if not file.is_file():
        return None
    raw = None
    for e in _iter_lines(file):
        if e.get("type") == "system" and e.get("subtype") == "local_command":
            content = e.get("content")
            if isinstance(content, str) and "<local-command-stdout>" in content:
                raw = content
    if not raw:
        return None
    md = raw.split("<local-command-stdout>", 1)[1].split("</local-command-stdout>", 1)[0].strip()
    return md or None


def session_context(cwd: str, session_id: str, max_chars: int = 4000) -> str:
    """Recent user/assistant text from the live session, as reference context for a side
    question. Returns the tail (most recent), command-meta and sidechain entries excluded."""
    if not session_id:
        return ""
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return ""
    if not file.is_file():
        return ""
    parts: list[str] = []
    for entry in _iter_lines(file):
        if entry.get("type") not in _TRAVELLING_TYPES or entry.get("isMeta") or entry.get("isSidechain"):
            continue
        text = _text_from_content(entry.get("message", {}).get("content"))
        if text and not _COMMAND_META_RE.search(text) and not _INTERRUPT_RE.match(text):
            parts.append(f"{entry.get('type')}: {text}")
    return "\n".join(parts)[-max_chars:]


_BRANCH_KEYS = ("uuid", "parentUuid", "logicalParentUuid", "isSidechain", "type", "subtype", "isCompactSummary")


def _conversation_row(entry: dict) -> Optional[dict]:
    if entry.get("isSidechain"):
        return None
    if entry.get("isCompactSummary"):
        role, text = "summary", _compact_summary_text(entry)
    elif entry.get("type") == "assistant":
        content = (entry.get("message") or {}).get("content")
        blocks = content if isinstance(content, list) else []
        role = "assistant"
        text = "\n".join(b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text").strip()
    else:
        role, text = "user", (_user_row(entry) or {}).get("text") or ""
    return {"role": role, "text": text, "ts": _parse_ts(entry.get("timestamp"))} if text else None


def _skeleton(entry: dict) -> dict:
    kept = {key: entry[key] for key in _BRANCH_KEYS if key in entry}
    message = entry.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        blocks = [{"type": b.get("type")} for b in content if isinstance(b, dict)] if isinstance(content, list) else None
        kept["message"] = {"id": message.get("id"), "content": blocks}
    return kept


def conversation(cwd: str, session_id: str) -> list[dict]:
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return []
    if not file.is_file():
        return []
    segments: list[list[dict]] = [[]]
    for entry in _iter_lines(file):
        skeleton = _skeleton(entry)
        row = _conversation_row(entry)
        if row is not None:
            skeleton["row"] = row
        if skeleton.get("type") == "system" and skeleton.get("subtype") == "compact_boundary":
            segments.append([])
        segments[-1].append(skeleton)
    return [
        skeleton["row"]
        for segment in segments
        for skeleton in _active_entries(segment, session_id)
        if "row" in skeleton
    ]


_TASK_CREATED_RE = re.compile(r"Task #(\d+) created", re.IGNORECASE)


def _tasks_from_transcript(project_key: str, session_id: str) -> Optional[list[dict]]:
    """Task state replayed from the recorded tool calls. A call answered "not found"
    is proof the task is gone, which the on-disk store cannot express."""
    try:
        path = _session_file(project_key, session_id)
    except ValueError:
        return None
    if not path.is_file():
        return None

    calls: dict[str, tuple[str, dict]] = {}
    tasks: dict[str, dict] = {}
    seen = False
    for entry in _iter_lines(path):
        if entry.get("type") not in _TRAVELLING_TYPES:
            continue
        message = entry.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use" and block.get("name") in ("TaskCreate", "TaskUpdate"):
                calls[block.get("id")] = (block["name"], block.get("input") or {})
                seen = True
                continue
            if block.get("type") != "tool_result":
                continue
            call = calls.pop(block.get("tool_use_id"), None)
            if call is None:
                continue
            name, params = call
            output = _text_from_content(block.get("content")).lower()
            if "tool_use_error" in output or "inputvalidationerror" in output:
                continue
            if name == "TaskCreate":
                match = _TASK_CREATED_RE.search(output)
                if match:
                    tasks[match.group(1)] = {
                        "id": match.group(1),
                        "content": str(params.get("subject") or ""),
                        "status": "pending",
                    }
                continue
            key = str(params.get("taskId") or "")
            status = params.get("status")
            if "not found" in output or status == "deleted":
                tasks.pop(key, None)
            elif status and key in tasks:
                tasks[key]["status"] = status
    return list(tasks.values()) if seen else None


def session_tasks(session_id: str, project_key: str = "") -> list[dict]:
    """Current task state for a resumed chat, which the SDK doesn't re-stream. Rebuilt
    from the transcript, falling back to ~/.claude/tasks/<id>/<n>.json."""
    if not _SESSION_RE.match(session_id or ""):
        return []
    if project_key:
        replayed = _tasks_from_transcript(project_key, session_id)
        if replayed is not None:
            return [] if all(t["status"] == "completed" for t in replayed) else replayed
    directory = _base().parent / "tasks" / session_id
    if not directory.is_dir():
        return []
    files = sorted(directory.glob("*.json"), key=lambda p: int(p.stem) if p.stem.isdigit() else 0)
    tasks: list[dict] = []
    for file in files:
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(data, dict) and data.get("id"):
            tasks.append({
                "id": str(data["id"]),
                "content": data.get("subject", ""),
                "status": data.get("status", "pending"),
            })
    if tasks and all(t["status"] == "completed" for t in tasks):
        return []
    return tasks


def _entry_context_tokens(entry: dict) -> Optional[int]:
    """Context size recorded on a transcript entry's usage (input + cache reads)."""
    msg = entry.get("message")
    usage = msg.get("usage") if isinstance(msg, dict) else None
    if not isinstance(usage, dict):
        return None
    return prompt_cache.input_tokens(usage) or None


def _post_compact_context(entries: list[dict], boundary_idx: int) -> Optional[int]:
    """First real turn's context size after a compaction boundary. The summary's own usage
    reflects the pre-compaction read, so it's skipped."""
    for e in entries[boundary_idx + 1:]:
        if e.get("isCompactSummary"):
            continue
        total = _entry_context_tokens(e)
        if total:
            return total
    return None


def latest_compact(cwd: str, session_id: str) -> Optional[dict]:
    """The most recent compaction's metadata + summary from the transcript. Live compaction
    omits the token counts and summary, so the client finalizes the block after the turn to
    match the resumed view. ``postTokens`` was dropped from the CLI's compactMetadata, so the
    post-compaction size is recovered from the first real turn's usage after the boundary."""
    try:
        file = _session_file(project_key_for(cwd), session_id)
    except ValueError:
        return None
    if not file.is_file():
        return None
    meta: dict = {}
    summary = ""
    post: Optional[int] = None
    post_locked = False
    for entry in _iter_lines(file):
        if entry.get("type") == "system" and entry.get("subtype") == "compact_boundary":
            meta = entry.get("compactMetadata") or {}
            summary = ""
            post = None
            post_locked = False
            continue
        if entry.get("isCompactSummary"):
            summary = _compact_summary_text(entry)
            continue
        if not post_locked:
            total = _entry_context_tokens(entry)
            if total:
                post = total
                post_locked = True
    if not meta and not summary:
        return None
    return {
        "trigger": meta.get("trigger"),
        "pre_tokens": meta.get("preTokens"),
        "post_tokens": meta.get("postTokens") or post,
        "summary": summary,
    }


def _is_compact_marker(entry: dict) -> bool:
    """A compaction boundary or its summary — a marker on the thread, not a branch of it."""
    return (entry.get("type") == "system" and entry.get("subtype") == "compact_boundary") or bool(entry.get("isCompactSummary"))


def _reply_id(entry: dict) -> Optional[str]:
    message = entry.get("message")
    return message.get("id") if entry.get("type") == "assistant" and isinstance(message, dict) else None


def _carries_only_tool_results(entry: dict) -> bool:
    message = entry.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    return (
        isinstance(content, list)
        and bool(content)
        and all(isinstance(block, dict) and block.get("type") == "tool_result" for block in content)
    )


def _active_entries(entries: list[dict], session_id: str) -> list[dict]:
    """Only the transcript's active branch: rewound turns append as siblings, so walk
    parentUuid (logicalParentUuid across compacts) back from the last entry, like the
    CLI does. A pending (not yet branched) rewind truncates at its anchor instead."""
    from services import rewind

    anchor = rewind.get_pending(session_id)
    if anchor is not None:
        idx = next((i for i, e in enumerate(entries) if e.get("uuid") == anchor), None)
        if idx is not None:
            entries = entries[: idx + 1]

    by_uuid: dict[str, dict] = {}
    child_count: dict[str, int] = {}
    leaf = None
    for e in entries:
        u = e.get("uuid")
        if not u or e.get("isSidechain"):
            continue
        by_uuid[u] = e
        if _is_compact_marker(e):
            continue
        parent = e.get("parentUuid") or e.get("logicalParentUuid")
        if parent:
            child_count[parent] = child_count.get(parent, 0) + 1
        leaf = e
    if leaf is None or all(c < 2 for c in child_count.values()):
        return entries
    active: set[str] = set()
    cur = leaf
    while cur is not None:
        u = cur.get("uuid")
        if u in active:
            break
        active.add(u)
        parent = cur.get("parentUuid") or cur.get("logicalParentUuid")
        cur = by_uuid.get(parent) if parent else None
    replies = {_reply_id(e) for e in by_uuid.values() if e.get("uuid") in active} - {None}
    active |= {u for u, e in by_uuid.items() if _reply_id(e) in replies}
    return [
        e for e in entries
        if not e.get("uuid")
        or e.get("isSidechain")
        or _is_compact_marker(e)
        or e.get("uuid") in active
        or (
            _carries_only_tool_results(e)
            and (e.get("parentUuid") or e.get("logicalParentUuid")) in active
        )
    ]


def list_checkpoints(project_key: str, session_id: str) -> list[dict]:
    """Rewind points: each real user prompt on the active branch. `id` rewinds files;
    `rewind_id` is the previous assistant TEXT entry (--resume-session-at accepts only
    those), which is why the first prompt is omitted."""
    file = _session_file(project_key, session_id)
    if not file.is_file():
        return []
    entries = _active_entries(list(_iter_lines(file, _last_compact_offset(file))), session_id)
    points: list[dict] = []
    last_anchor: Optional[str] = None
    for entry in entries:
        etype = entry.get("type")
        if entry.get("isMeta") or entry.get("isSidechain") or entry.get("isCompactSummary"):
            continue
        uuid = entry.get("uuid")
        content = entry.get("message", {}).get("content")
        if etype == "assistant" and uuid and isinstance(content, list):
            if any(isinstance(b, dict) and b.get("type") == "text" and (b.get("text") or "").strip() for b in content):
                last_anchor = uuid
            continue
        if etype != "user" or not uuid:
            continue
        if isinstance(content, str):
            text = content.strip()
        elif isinstance(content, list):
            if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                continue
            text = "\n".join(
                b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
            ).strip()
        else:
            continue
        if not text or _COMMAND_META_RE.search(text) or _INTERRUPT_RE.match(text):
            continue
        if last_anchor is None:
            continue
        points.append({
            "id": uuid,
            "rewind_id": last_anchor,
            "text": text[:300],
            "ts": entry.get("timestamp"),
        })
    return points


def _parse_ts(value) -> Optional[int]:
    if not isinstance(value, str) or not value:
        return None
    try:
        from datetime import datetime
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return None


def _tool_durations(entries: list[dict]) -> dict[str, int]:
    """How long each tool call took, from the transcript's own entry timestamps."""
    started: dict[str, int] = {}
    elapsed: dict[str, int] = {}
    for entry in entries:
        if entry.get("type") not in _TRAVELLING_TYPES:
            continue
        content = (entry.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        stamp = _parse_ts(entry.get("timestamp"))
        if stamp is None:
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use":
                bid = block.get("id")
                if isinstance(bid, str):
                    started[bid] = stamp
            elif block.get("type") == "tool_result":
                tuid = block.get("tool_use_id")
                began = started.pop(tuid, None) if isinstance(tuid, str) else None
                if began is not None and stamp >= began:
                    elapsed[tuid] = stamp - began
    return elapsed


class _StampedList(list):
    cur_ts: Optional[int] = None
    cur_parent: Optional[str] = None

    def append(self, item):
        if isinstance(item, dict):
            if self.cur_ts is not None:
                item.setdefault("ts", self.cur_ts)
            if self.cur_parent is not None:
                item.setdefault("parent", self.cur_parent)
        super().append(item)


def _thinking_tokens(message: dict) -> Optional[int]:
    """The final thinking count the API reported, more exact than the live estimate."""
    details = ((message.get("usage") or {}).get("output_tokens_details") or {})
    tokens = details.get("thinking_tokens")
    return tokens if isinstance(tokens, int) and tokens > 0 else None


def _thinking_item(block: dict, message: dict, vis: dict) -> Optional[dict]:
    if vis["thinking"] == "label":
        item: dict = {"type": "thinking", "label": True}
    else:
        text = (block.get("thinking") or block.get("text", "")).strip()
        if not text:
            return None
        item = {"type": "thinking", "text": text}
    tokens = _thinking_tokens(message) if vis.get("tokens") else None
    if tokens:
        item["tokens"] = tokens
    return item


def _agent_result(tur: dict, vis: dict) -> dict:
    """The live `agent_result` shape, rebuilt from the transcript's own field names."""
    return {
        "status": tur.get("status"),
        "duration_ms": tur.get("totalDurationMs") if vis.get("timings") else None,
        "tokens": tur.get("totalTokens") if vis.get("tokens") else None,
        "tool_uses": tur.get("totalToolUseCount"),
    }


def _subagent_file(session_dir: Path, agent_id: str) -> Optional[Path]:
    """A subagent transcript sits in `subagents/`, or nested under `workflows/<run>/`."""
    base = session_dir / "subagents"
    name = f"agent-{agent_id}.jsonl"
    flat = base / name
    return flat if flat.is_file() else next(base.rglob(name), None)


def _subagent_blocks(sub_file: Path, parent_id: Optional[str], vis: dict) -> list[dict]:
    from services.claude_runtime import (
        _FILE_EDIT_TOOLS, _build_file_diff, _format_tool_input,
        _tool_naming, _flatten_result_content,
    )
    entries = [entry for entry in _iter_lines(sub_file) if entry.get("type") in _TRAVELLING_TYPES]
    tool_calls.remember_entries(entries)
    sub_ms = _tool_durations(entries)
    sub_results: dict[str, object] = {}
    for entry in entries:
        content = (entry.get("message") or {}).get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    tuid = block.get("tool_use_id")
                    if isinstance(tuid, str):
                        sub_results[tuid] = block.get("content")
    out: list[dict] = []
    for entry in entries:
        message = entry.get("message", {})
        if message.get("role") != "assistant":
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                text = (block.get("text") or "").strip()
                if text:
                    out.append({"type": "text", "role": "assistant", "text": text, "parent": parent_id})
                continue
            if block.get("type") == "thinking":
                item = _thinking_item(block, message, vis) if vis["thinking"] != "off" else None
                if item:
                    out.append({**item, "parent": parent_id})
                continue
            if block.get("type") != "tool_use":
                continue
            name = (block.get("name") or "").strip()
            inp = block.get("input")
            bid = block.get("id")
            if name == "Agent" or name == "TodoWrite" or name.startswith("Task"):
                continue
            if name in _FILE_EDIT_TOOLS and isinstance(inp, dict):
                path = inp.get("file_path") or inp.get("notebook_path")
                if isinstance(path, str) and path:
                    if vis["file_change"] == "off":
                        _working(out, vis)
                        continue
                    if vis["file_change"] == "label":
                        out.append({"type": "file_change", "name": name, "path": path, "id": bid, "label": True, "parent": parent_id})
                        continue
                    out.append({"type": "file_change", "name": name, "path": path, "diff_lines": _build_file_diff(name, inp, path), "id": bid, "parent": parent_id})
                    continue
            if vis["tool_use"] == "off":
                _working(out, vis)
                continue
            ev = {"type": "tool_use", **_tool_naming(name), "text": _format_tool_input(inp), "id": bid, "parent": parent_id}
            took = sub_ms.get(bid or "") if vis.get("timings") else None
            if took is not None:
                ev["ms"] = took
            if vis["tool_use"] == "full":
                result = _flatten_result_content(sub_results.get(bid or "")).strip()
                if result:
                    ev["result"] = result
            out.append(ev)
    return out


_NOTIFICATION_BLOCK_RE = re.compile(r"<task-notification>(.*?)</task-notification>", re.DOTALL)
_SESSION_MESSAGE_RE = re.compile(r"<cross-session-message\b([^>]*)>(.*?)</cross-session-message>", re.DOTALL)
_AGENT_MESSAGE_RE = re.compile(r"<agent-message\b([^>]*)>(.*?)</agent-message>", re.DOTALL)
_PLUGIN_MESSAGE_RE = re.compile(
    r"The (.+?) plugin sent a message(?: while you were working)?:\n(.*?)\n\nThis is how Claude Code surfaces "
    r"(?:a prompt a plugin submits|prompts a plugin submits) .*\Z",
    re.DOTALL,
)
_INCOMING_LEAD = "Another Claude session sent a message:"
_REPORT_LEAD_RE = re.compile(r"^.*?The report follows:[ \t]*\n", re.DOTALL)
_ATTRIBUTE_RE = re.compile(r'([\w-]+)="([^"]*)"')


def _session_message(match: re.Match) -> dict:
    attributes = dict(_ATTRIBUTE_RE.findall(match.group(1)))
    return {
        "type": "session_message",
        "name": attributes.get("from-name") or "",
        "text": match.group(2).strip(),
    }


def _session_message_item(text: str) -> dict | None:
    match = _SESSION_MESSAGE_RE.match(text.strip())
    return _session_message(match) if match else None


def _plugin_message_item(text: str) -> dict | None:
    """A prompt a plugin submitted, without the frame the CLI puts around it for the model."""
    match = _PLUGIN_MESSAGE_RE.match(text.strip())
    if not match:
        return None
    return {"type": "plugin_message", "name": match.group(1), "text": match.group(2).strip()}


def _agent_report(match: re.Match) -> dict:
    """The final report a subagent hands back, without the harness frame around it."""
    attributes = dict(_ATTRIBUTE_RE.findall(match.group(1)))
    body = _REPORT_LEAD_RE.sub("", match.group(2).strip("\n"), count=1)
    return {
        "type": "agent_report",
        "name": attributes.get("from-name") or "",
        "text": dedent(body).strip(),
    }


def _agent_reports(text: str) -> list[dict]:
    return [_agent_report(match) for match in _AGENT_MESSAGE_RE.finditer(text or "")]


def _without_reports(text: str) -> str:
    return _AGENT_MESSAGE_RE.sub("", text or "").replace(_INCOMING_LEAD, "").strip()


def _agent_report_item(text: str) -> dict | None:
    reports = _agent_reports(text)
    return reports[0] if reports and not _without_reports(text) else None


def _tag(text: str, name: str) -> str | None:
    found = re.search(rf"<{name}>(.*?)</{name}>", text, re.DOTALL)
    return found.group(1).strip() if found else None


def _as_int(value: str | None) -> Optional[int]:
    return int(value) if value and value.isdigit() else None


def _notified_results(text: str) -> dict[str, dict]:
    """What a finished agent reports about itself, keyed by the call that launched it."""
    results = {}
    for match in _NOTIFICATION_BLOCK_RE.finditer(text or ""):
        body = match.group(1)
        tool_use_id = _tag(body, "tool-use-id")
        if not tool_use_id:
            continue
        usage = _tag(body, "usage") or ""
        results[tool_use_id] = {
            "status": _tag(body, "status"),
            "totalDurationMs": _as_int(_tag(usage, "duration_ms")),
            "totalTokens": _as_int(_tag(usage, "subagent_tokens")),
            "totalToolUseCount": _as_int(_tag(usage, "tool_uses")),
        }
    return results


TASK_COMPLETED = "completed"
TASK_FAILED = "failed"
TASK_STOPPED = "stopped"


def task_notification(tool_use_id: str, status: str, summary: str, result: str, duration_ms: int) -> str:
    lines = [
        f"<tool-use-id>{tool_use_id}</tool-use-id>",
        f"<status>{status}</status>",
        f"<summary>{summary}</summary>",
        *([f"<result>{result}</result>"] if result else []),
        f"<usage><duration_ms>{duration_ms}</duration_ms></usage>",
    ]
    return "\n".join(["<task-notification>", *lines, "</task-notification>"])


def _split_notifications(text: str) -> tuple[str, list[dict]]:
    """Notifications, plugin prompts and cross-session messages the CLI carries inside user text."""
    plugin = _plugin_message_item(text)
    if plugin is not None:
        return "", [plugin]
    items = []
    for match in _NOTIFICATION_BLOCK_RE.finditer(text):
        body = match.group(1)
        items.append({"type": "notification", "text": _tag(body, "summary") or "", "result": _tag(body, "status")})
    if items:
        text = _NOTIFICATION_BLOCK_RE.sub("", text).strip()
    session_items = [_session_message(match) for match in _SESSION_MESSAGE_RE.finditer(text)]
    if session_items:
        text = _SESSION_MESSAGE_RE.sub("", text).strip()
    reports = _agent_reports(text)
    if reports:
        text = _without_reports(text)
    return text, items + session_items + reports


def _notification_item(text: str) -> dict | None:
    if not text.startswith("<task-notification>"):
        return None
    return {"type": "notification", "text": _tag(text, "summary") or "", "result": _tag(text, "status")}


def _working(messages, vis) -> None:
    """One ``working`` marker per run of hidden blocks, matching the live turn."""
    if not vis.get("simple"):
        return
    if messages and messages[-1].get("type") == "working":
        return
    messages.append({"type": "working"})


def user_prompts(messages: list[dict], limit: int = 100) -> list[str]:
    """The composer's history, taken from the transcript already normalized for this request."""
    prompts: list[str] = []
    for message in messages:
        if message.get("role") != "user" or message.get("type") != "text":
            continue
        text = (message.get("text") or "").strip()
        if not text or (prompts and prompts[-1] == text):
            continue
        prompts.append(text)
    return prompts[-limit:]


def main_count(messages: list[dict]) -> int:
    return sum(1 for message in messages if not message.get("parent"))


def committed_index(messages: list[dict], main: int, split: bool = False) -> int:
    start = _main_index(messages, main)
    if not split:
        return start
    stops = [index for index in range(start, len(messages)) if _interrupt_mark(messages[index])]
    return stops[-1] + 1 if stops else start


def _main_index(messages: list[dict], main: int) -> int:
    seen = 0
    for index, message in enumerate(messages):
        if message.get("parent"):
            continue
        if seen == main:
            return index
        seen += 1
    return len(messages)


def _interrupt_mark(message: dict) -> bool:
    return message.get("type") == "interrupted" and not message.get("parent")


def get_session_messages(
    project_key: str,
    session_id: str,
    prefs: dict | None = None,
    trashed: bool = False,
) -> list[dict]:
    file = _session_file(project_key, session_id, trashed)
    if not file.is_file():
        return []
    entries = _active_entries(list(_iter_lines(file, _last_compact_offset(file))), session_id)
    tool_calls.remember_entries(entries)
    queued_user_texts: set[str] = set()
    real_user_texts: set[str] = set()

    def _register_user_text(t: str, real: bool) -> None:
        t = (t or "").strip()
        if not t:
            return
        queued_user_texts.add(t)
        if real:
            real_user_texts.add(t)
        for line in t.split("\n"):
            line = line.strip()
            if line:
                queued_user_texts.add(line)
                if real:
                    real_user_texts.add(line)

    for entry in entries:
        if entry.get("type") == "attachment":
            att = entry.get("attachment") or {}
            if att.get("type") == "queued_command":
                _register_user_text(_text_from_content(att.get("prompt")), real=False)
            continue
        if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
            continue
        c = entry.get("message", {}).get("content")
        if isinstance(c, str):
            cmd = _COMMAND_NAME_RE.search(c)
            _register_user_text(cmd.group(1) if cmd else c, real=True)
        elif isinstance(c, list):
            for b in c:
                if isinstance(b, dict) and b.get("type") == "text":
                    _register_user_text(b.get("text") or "", real=True)
    tool_result_by_id: dict[str, object] = {}
    tool_ms = _tool_durations(entries)
    agent_files: dict[str, str] = {}
    agent_results: dict[str, dict] = {}
    notified: dict[str, dict] = {}
    for entry in entries:
        queued = entry.get("content")
        if isinstance(queued, str):
            notified.update(_notified_results(queued))
        if entry.get("type") not in _TRAVELLING_TYPES:
            continue
        content = entry.get("message", {}).get("content")
        notified.update(_notified_results(_text_from_content(content)))
        tur = entry.get("toolUseResult")
        aid = tur.get("agentId") if isinstance(tur, dict) else None
        if not isinstance(content, list):
            continue
        for block in content:
            if isinstance(block, dict) and block.get("type") == "tool_result":
                tuid = block.get("tool_use_id")
                if isinstance(tuid, str):
                    tool_result_by_id[tuid] = block.get("content")
                    if isinstance(aid, str) and aid:
                        agent_files[tuid] = aid
                        agent_results[tuid] = tur
    last_boundary = max(
        (i for i, e in enumerate(entries)
         if e.get("type") == "system" and e.get("subtype") == "compact_boundary"),
        default=-1,
    )
    vis = visibility.resolve(prefs)
    messages = _StampedList()
    reported: set[str] = set()

    def _once(items: list[dict]) -> list[dict]:
        """A hand-back is written twice, once queued and once delivered."""
        kept = []
        for item in items:
            if item.get("type") == "agent_report":
                if item["text"] in reported:
                    continue
                reported.add(item["text"])
            kept.append(item)
        return kept

    hidden_ids: set[str] = set()
    compact_block: dict | None = None
    for i, entry in enumerate(entries):
        messages.cur_ts = _parse_ts(entry.get("timestamp"))
        messages.cur_parent = None
        etype = entry.get("type")
        if etype == "system" and entry.get("subtype") == "compact_boundary":
            if i != last_boundary:
                continue  # an earlier compaction, part of the truncated-away history
            meta = entry.get("compactMetadata") or {}
            compact_block = {
                "type": "compact",
                "trigger": meta.get("trigger"),
                "pre_tokens": meta.get("preTokens"),
                "post_tokens": meta.get("postTokens") or _post_compact_context(entries, i),
                "summary": "",
            }
            messages.append(compact_block)
            continue
        if entry.get("isCompactSummary"):
            if compact_block is not None and i > last_boundary and vis["compact"] != "label":
                compact_block["summary"] = _compact_summary_text(entry)
            continue
        if etype == "summary":
            text = entry.get("summary", "").strip()
            if text:
                messages.append({"type": "summary", "text": text})
            continue
        if entry.get("isMeta"):
            if i >= last_boundary:
                messages.extend(_once(_agent_reports(_text_from_content(entry.get("message", {}).get("content")))))
            continue
        if i < last_boundary:
            continue
        if etype == "system" and entry.get("subtype") == "informational":
            messages.append(mods.kept_notice(entry.get("content"), entry.get("level"), entry.get("uuid")))
            continue
        if etype == "attachment":
            att = entry.get("attachment") or {}
            if att.get("type") == "queued_command":
                qtext = _text_from_content(att.get("prompt")).strip()
                qlines = [ln.strip() for ln in qtext.split("\n") if ln.strip()]
                consumed = bool(qlines) and all(ln in real_user_texts for ln in qlines)
                qtext, notifs = _split_notifications(qtext)
                if qtext and not consumed and not _COMMAND_META_RE.search(qtext) and not _INTERRUPT_RE.match(qtext):
                    messages.append({"type": "text", "role": "user", "text": qtext})
                messages.extend(_once(notifs))
            continue
        if etype == "queue-operation":
            if entry.get("operation") == "enqueue":
                qtext = (entry.get("content") or "").strip()
                seen = qtext in queued_user_texts
                qtext, notifs = _split_notifications(qtext)
                if qtext and not seen and not _COMMAND_META_RE.search(qtext) and not _INTERRUPT_RE.match(qtext):
                    messages.append({"type": "text", "role": "user", "text": qtext})
                if not seen:
                    messages.extend(_once(notifs))
            continue
        if etype not in _TRAVELLING_TYPES or entry.get("isSidechain"):
            continue
        message = entry.get("message", {})
        if entry.get("isApiErrorMessage"):
            err_text = _text_from_content(message.get("content")).strip()
            if err_text:
                messages.append(api_error(err_text, entry.get("error")))
            continue
        if message.get("stop_reason") == "stop_sequence":
            continue
        role = message.get("role", etype)
        content = message.get("content")
        if role == "user":
            interrupt_text = content if isinstance(content, str) else _text_from_content(content)
            if _INTERRUPT_RE.match((interrupt_text or "").strip()):
                messages.append({"type": "interrupted"})
                continue
        if isinstance(content, str):
            text = content.strip()
            text, notifs = _split_notifications(text)
            if text and not _COMMAND_META_RE.search(text) and not _INTERRUPT_RE.match(text):
                messages.append({"type": "text", "role": role, "text": text})
            messages.extend(_once(notifs))
            continue
        if not isinstance(content, list):
            continue
        user_images = None
        if role == "user":
            refs = [
                {"uuid": entry.get("uuid"), "index": j}
                for j, b in enumerate(content)
                if isinstance(b, dict) and b.get("type") == "image"
            ]
            user_images = refs or None
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "text":
                text = block.get("text", "").strip()
                text, notifs = _split_notifications(text)
                if text and not _COMMAND_META_RE.search(text) and not _INTERRUPT_RE.match(text):
                    item = {"type": "text", "role": role, "text": text}
                    if user_images:
                        item["images"] = user_images
                        user_images = None
                    messages.append(item)
                messages.extend(_once(notifs))
            elif btype == "thinking":
                if vis["thinking"] == "off":
                    _working(messages, vis)
                    continue
                item = _thinking_item(block, message, vis)
                if item:
                    messages.append(item)
            elif btype == "tool_use":
                from mcps import packs as packs_tool, shared_files
                from services.claude_runtime import _FILE_EDIT_TOOLS, _PACKS_RULE, _SHARE_RULE, _agent_event, _agent_input, _build_file_diff, _flatten_result_content, _format_tool_input, _tool_naming
                name = (block.get("name") or "").strip()
                inp = block.get("input")
                bid = block.get("id")
                if name == "AskUserQuestion" and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    result_content = tool_result_by_id.get(bid or "")
                    if result_content is None:
                        continue
                    qs = [q for q in (inp.get("questions") or []) if isinstance(q, dict)]
                    qtexts = [q.get("question") or q.get("header") or "" for q in qs]
                    declined = DECLINE_MARK in _flatten_result_content(result_content)
                    parsed = {} if declined else _parse_ask_result(result_content, qtexts)
                    answered = {
                        str(q.get("question", "")): parsed.get(q.get("question") or q.get("header") or "", ("", ""))
                        for q in qs
                    }
                    messages.append({
                        "type": "interaction",
                        "kind": "component",
                        "title_key": "questions",
                        "submit_key": SUBMIT_KEY,
                        "dismiss": DISMISS,
                        "blocks": questions_to_blocks(qs),
                        "values": values_from_answers(qs, answered),
                        "submitted": True,
                        "declined": declined,
                    })
                    continue
                if name.endswith("show_component") and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    messages.append({
                        "type": "interaction",
                        "kind": "component",
                        "shown": True,
                        "title": inp.get("title"),
                        "icon": inp.get("icon"),
                        "blocks": [b for b in (inp.get("blocks") or []) if isinstance(b, dict)],
                    })
                    continue
                if name.endswith("ask_component") and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    answered = _parse_component_result(tool_result_by_id.get(bid or ""))
                    if answered is None:
                        continue
                    messages.append({
                        "type": "interaction",
                        "kind": "component",
                        "title": inp.get("title"),
                        "submit": inp.get("submit"),
                        "dismiss": inp.get("dismiss"),
                        "blocks": [b for b in (inp.get("blocks") or []) if isinstance(b, dict)],
                        "values": answered["values"],
                        "submitted": True,
                        "declined": answered["dismissed"],
                        "dismissed_by": answered["dismissed_by"],
                    })
                    continue
                if name == "ExitPlanMode" and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    rc = tool_result_by_id.get(bid or "")
                    if isinstance(rc, list):
                        rtext = " ".join(b.get("text", "") for b in rc if isinstance(b, dict))
                    elif isinstance(rc, str):
                        rtext = rc
                    else:
                        rtext = ""
                    if "redirect" in rtext:
                        resolved = "different"
                    elif "approved" in rtext:
                        resolved = "allow"
                    elif "proceed" in rtext or "reject" in rtext or "declined" in rtext:
                        resolved = "deny"
                    else:
                        resolved = "allow"
                    messages.append({
                        "type": "interaction",
                        "kind": "permission",
                        "tool_name": "ExitPlanMode",
                        "input": (inp.get("plan") or "").strip(),
                        "resolved": resolved,
                    })
                    continue
                if name == "Agent" and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    if vis["tool_use"] != "off":
                        block_event = _agent_event(bid, inp)
                        done =notified.get(bid or "") or agent_results.get(bid or "")
                        if done is not None:
                            block_event["agent_result"] = _agent_result(done, vis)
                        messages.append(block_event)
                        aid = agent_files.get(bid or "")
                        sub_file = _subagent_file(file.parent / session_id, aid) if aid else None
                        if sub_file is not None:
                            for child in _subagent_blocks(sub_file, bid, vis):
                                messages.append(child)
                    continue
                if name == delegates.TOOL_ID and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    if vis["tool_use"] != "off":
                        block_event = _agent_event(bid, _agent_input(name, inp))
                        done = notified.get(bid or "")
                        if done is not None:
                            block_event["agent_result"] = _agent_result(done, vis)
                        messages.append(block_event)
                        steps = delegate_runs.children(session_id, bid, vis) if isinstance(bid, str) else None
                        messages.extend(steps or [])
                        answer = _flatten_result_content(tool_result_by_id.get(bid or "")).strip()
                        launched = done is not None or (isinstance(bid, str) and delegate_runs.running(session_id, bid))
                        if answer and not launched and not any(step["type"] == "text" for step in steps or []):
                            messages.append({"type": "text", "role": "assistant", "text": answer, "parent": bid})
                    continue
                if name == "TodoWrite" or name.startswith("Task"):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    continue
                if name == _SHARE_RULE and isinstance(inp, dict):
                    if isinstance(bid, str):
                        hidden_ids.add(bid)
                    handed = shared_files.listing(inp, project_key)
                    if handed:
                        messages.append({"type": "shared", "files": handed, "id": bid})
                    continue
                if name in _FILE_EDIT_TOOLS and isinstance(inp, dict):
                    path = inp.get("file_path") or inp.get("notebook_path")
                    if isinstance(path, str) and path:
                        if isinstance(bid, str):
                            hidden_ids.add(bid)
                        if vis["file_change"] == "off":
                            _working(messages, vis)
                            continue
                        if vis["file_change"] == "label":
                            messages.append({"type": "file_change", "name": name, "path": path, "id": bid, "label": True})
                            continue
                        messages.append({
                            "type": "file_change",
                            "name": name,
                            "path": path,
                            "diff_lines": _build_file_diff(name, inp, path),
                            "id": bid,
                        })
                        continue
                pack_id = str(inp.get("id") or "").strip() if isinstance(inp, dict) else ""
                exported = name == _PACKS_RULE and inp.get("action") == "export" and pack_id
                if vis["tool_use"] == "off":
                    _working(messages, vis)
                else:
                    ev = {"type": "tool_use", **_tool_naming(name), "text": _format_tool_input(inp), "id": bid}
                    took = tool_ms.get(bid or "") if vis.get("timings") else None
                    if took is not None:
                        ev["ms"] = took
                    if vis["tool_use"] == "full":
                        result = _flatten_result_content(tool_result_by_id.get(bid or "")).strip()
                        if result:
                            ev["result"] = result
                    messages.append(ev)
                if exported:
                    messages.append({"type": "shared", "files": packs_tool.exported(pack_id, project_key)})
        if user_images:
            messages.append({"type": "text", "role": role, "text": "", "images": user_images})
    return messages


def get_message_image(
    project_key: str,
    session_id: str,
    uuid: str,
    index: int,
    trashed: bool = False,
) -> tuple[str, bytes] | None:
    import base64

    file = _session_file(project_key, session_id, trashed)
    if not file.is_file():
        return None
    for entry in _iter_lines(file):
        if entry.get("uuid") != uuid:
            continue
        content = (entry.get("message") or {}).get("content")
        if not isinstance(content, list) or not (0 <= index < len(content)):
            return None
        block = content[index]
        if not isinstance(block, dict) or block.get("type") != "image":
            return None
        source = block.get("source") or {}
        data = source.get("data")
        if not isinstance(data, str):
            return None
        try:
            return source.get("media_type") or "image/png", base64.b64decode(data)
        except Exception:
            return None
    return None
