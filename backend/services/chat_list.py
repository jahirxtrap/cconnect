"""Live chat/project list updates over a dedicated WebSocket.

A filesystem watcher (``watchfiles``, in its own thread, with a polling fallback when it
fails) over the top two levels of the Claude projects directory keeps a lightweight
in-memory snapshot of the session/project list. A change re-scans only the project
folders it touched, reusing cached metadata for files whose (mtime, size) is unchanged,
diffs against the snapshot and broadcasts only the per-item deltas to subscribed
clients, and tells whoever follows a transcript that it was written.
"""

import asyncio
import threading
from pathlib import Path
from typing import Callable, Iterable, Optional

from loguru import logger
from watchfiles import watch

from core.config import CLAUDE_PROJECTS_DIR
from services import projects as projects_service
from services import rewind
from services import sessions as sessions_service

_DEBOUNCE_MS = 500
_POLL_SECONDS = 2.0
_TRANSCRIPT = ".jsonl"

Folder = tuple[Optional[dict], dict[str, dict], set[str]]


def _session_sig(s: dict) -> tuple:
    return (s.get("title"), s.get("color"), s.get("preview"), s.get("last_active"),
            s.get("size"), s.get("path"), s.get("project_key"), s.get("activity"), s.get("rewind"))


def _project_sig(p: dict) -> tuple:
    return (p.get("path"), p.get("name"), p.get("custom_name"), p.get("session_count"), p.get("last_active"))


def _parts(base: Path, path: str) -> tuple[str, ...]:
    try:
        return Path(path).relative_to(base).parts
    except ValueError:
        return ()


def _touched(changed: Iterable[tuple[str, ...]]) -> dict[str, Optional[set[str]]]:
    """Per project folder, the transcripts a batch of changes wrote, or None when the folder itself came or went."""
    touched: dict[str, Optional[set[str]]] = {}
    for parts in changed:
        if len(parts) == 1:
            touched[parts[0]] = None
            continue
        names = touched.setdefault(parts[0], set())
        if names is not None and parts[1].endswith(_TRANSCRIPT):
            names.add(parts[1][: -len(_TRANSCRIPT)])
    return touched


class ChatListHub:
    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._activity: dict[str, str] = {}
        self._resident: set[str] = set()
        self._hidden: set[str] = set()
        self._projects: dict[str, dict] = {}
        self._sig_cache: dict[str, tuple] = {}
        self._folders: dict[str, Folder] = {}
        self._followers: set[Callable[[set[str]], None]] = set()
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._scanning = threading.Lock()
        self._stop = threading.Event()
        self._started = False

    async def start(self):
        if self._started:
            return
        self._started = True
        self._loop = asyncio.get_running_loop()
        await asyncio.to_thread(self._refresh, False)
        self._begin_watching()

    def stop(self):
        self._stop.set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    def follow_transcripts(self, written: Callable[[set[str]], None]) -> Callable[[], None]:
        """Call `written` on the event loop with the ids of the transcripts each change wrote, until the returned call stops it."""
        self._followers.add(written)
        return lambda: self._followers.discard(written)

    def snapshot(self) -> dict:
        from services import categories

        organization = categories.snapshot()
        with self._lock:
            return {
                "type": "snapshot",
                "projects": list(self._projects.values()),
                "sessions": list(self._sessions.values()),
                "categories": organization["categories"],
                "placement": organization["placement"],
                "agent_placement": organization["agent_placement"],
            }

    def publish(self, events: list[dict]):
        self._emit(events)

    def projects(self) -> list[dict]:
        with self._lock:
            return list(self._projects.values())

    def sessions(self) -> list[dict]:
        with self._lock:
            return list(self._sessions.values())

    def hide(self, session_id: str):
        with self._lock:
            self._hidden.add(session_id)
            listed = self._sessions.pop(session_id, None) is not None
        if listed:
            self._emit([{"type": "session_removed", "session_id": session_id}])

    async def unhide(self, *session_ids: str):
        with self._lock:
            self._hidden.difference_update(session_ids)
        await self.resync()

    def set_activity(self, session_id: Optional[str], activity: Optional[str], resident: Optional[bool] = None):
        if not session_id:
            return
        with self._lock:
            if activity:
                self._activity[session_id] = activity
            else:
                self._activity.pop(session_id, None)
            if resident is True:
                self._resident.add(session_id)
            elif resident is False:
                self._resident.discard(session_id)
        self.refresh_session(session_id)

    def refresh_session(self, session_id: str):
        with self._lock:
            entry = self._sessions.get(session_id)
            if entry is None:
                return
            updated = self._with_activity(session_id, entry)
            if updated == entry:
                return
            self._sessions[session_id] = updated
        self._emit([{"type": "session_changed", "session": updated}])

    def _with_activity(self, session_id: str, entry: dict) -> dict:
        updated = {key: value for key, value in entry.items() if key not in ("activity", "resident", "rewind")}
        activity = self._activity.get(session_id)
        if activity:
            updated["activity"] = activity
        if session_id in self._resident:
            updated["resident"] = True
        anchor = rewind.get_pending(session_id)
        if anchor:
            updated["rewind"] = anchor
        return updated

    def restore_activity(self, session_id: Optional[str]):
        from services.live_sessions import registry

        live = registry.get_by_session(session_id)
        self.set_activity(session_id, live.activity if live else None, live.resident_alive if live else False)

    async def resync(self):
        await asyncio.to_thread(self._refresh, True)

    async def settle_activity(self, session_id: Optional[str]):
        await asyncio.to_thread(self._refresh, True)
        self.restore_activity(session_id)

    def _emit(self, events: list[dict]):
        loop = self._loop
        if loop is None or not events:
            return

        def deliver():
            for q in list(self._subscribers):
                for ev in events:
                    q.put_nowait(ev)

        loop.call_soon_threadsafe(deliver)

    def _begin_watching(self):
        threading.Thread(target=self._watch_loop, name="chat-list-watch", daemon=True).start()

    def _watch_loop(self):
        base = Path(CLAUDE_PROJECTS_DIR).resolve()
        if base.is_dir():
            try:
                for changes in watch(
                    base,
                    watch_filter=lambda _change, path: 0 < len(_parts(base, path)) <= 2,
                    debounce=_DEBOUNCE_MS,
                    stop_event=self._stop,
                    raise_interrupt=False,
                    ignore_permission_denied=True,
                ):
                    touched = _touched(_parts(base, path) for _change, path in changes)
                    self._refresh(True, touched)
                    self._tell_followers({name for names in touched.values() if names for name in names})
                return
            except Exception as exc:
                logger.error(f"chat_list: {base} cannot be watched ({exc}); the list is read again every {_POLL_SECONDS:g} s")
        self._poll_loop()

    def _poll_loop(self):
        while not self._stop.wait(_POLL_SECONDS):
            with self._scanning:
                before = {sid: cached[0] for sid, cached in self._sig_cache.items()}
                self._rescan(True, None)
                written = {sid for sid, cached in self._sig_cache.items() if before.get(sid) != cached[0]}
            self._tell_followers(written)

    def _tell_followers(self, written: set[str]):
        loop = self._loop
        if loop is None or not written:
            return
        for follower in list(self._followers):
            loop.call_soon_threadsafe(follower, written)

    def _session_of(self, file: Path, pkey: str, live: set[str]) -> tuple[bool, Optional[dict]]:
        try:
            st = file.stat()
        except OSError:
            return False, None
        sid = file.stem
        sig = (st.st_mtime, st.st_size)
        cached = self._sig_cache.get(sid)
        if cached is not None and cached[0] == sig:
            return True, cached[1]
        cwd, preview, title, color, entrypoint, has_content = sessions_service._session_meta(file)
        if (entrypoint != "cli" and sid not in live) or (not has_content and not title):
            meta = None
        else:
            meta = {
                "session_id": sid,
                "project_key": pkey,
                "path": cwd,
                "last_active": st.st_mtime,
                "size": st.st_size,
                "preview": preview,
                "title": title,
                "color": color,
            }
        self._sig_cache[sid] = (sig, meta)
        return True, meta

    def _scan_folder(self, directory: Path, live: set[str], known: Optional[Folder], names: Optional[set[str]]) -> Folder:
        pkey = directory.name
        if known is None or names is None:
            listed: dict[str, dict] = {}
            found: set[str] = set()
            files = list(directory.glob(f"*{_TRANSCRIPT}"))
        else:
            listed, found = dict(known[1]), set(known[2])
            files = [directory / f"{name}{_TRANSCRIPT}" for name in names]
        for file in files:
            sid = file.stem
            exists, meta = self._session_of(file, pkey, live)
            listed.pop(sid, None)
            found.discard(sid)
            if exists:
                found.add(sid)
            if meta is not None:
                listed[sid] = meta
        newest = max(listed.values(), key=lambda meta: meta["last_active"], default=None)
        if newest is None:
            return None, listed, found
        project = {
            "project_key": pkey,
            "path": newest["path"],
            "name": sessions_service._project_name(newest["path"]),
            "custom_name": False,
            "session_count": len(listed),
            "last_active": newest["last_active"],
        }
        return project, listed, found

    def _scan(self, touched: Optional[dict[str, Optional[set[str]]]] = None) -> tuple[dict, dict]:
        from services.live_sessions import registry

        live = registry.live_session_ids()
        base = Path(CLAUDE_PROJECTS_DIR)
        projects: dict[str, dict] = {}
        sessions: dict[str, dict] = {}
        if not base.is_dir():
            return projects, sessions
        ai_keys = sessions_service._AI_PROJECT_KEYS
        folders: dict[str, Folder] = {}
        for directory in base.iterdir():
            pkey = directory.name
            if pkey in ai_keys or not directory.is_dir():
                continue
            known = self._folders.get(pkey) if touched is not None else None
            if known is not None and pkey not in touched:
                folders[pkey] = known
            else:
                folders[pkey] = self._scan_folder(directory, live, known, touched.get(pkey) if touched else None)
        self._folders = folders
        seen = {sid for _project, _listed, found in folders.values() for sid in found}
        for pkey, (project, listed, _found) in folders.items():
            if project is not None:
                projects[pkey] = dict(project)
            for sid, meta in listed.items():
                sessions[sid] = self._with_activity(sid, sessions_service.with_pinned(sid, meta))
        if len(self._sig_cache) > len(seen):
            self._sig_cache = {k: v for k, v in self._sig_cache.items() if k in seen}
        for key, meta in projects_service.snapshot().items():
            found = projects.get(key)
            if found is None:
                projects[key] = {
                    "project_key": key,
                    "path": meta["path"],
                    "name": meta["name"] or sessions_service._project_name(meta["path"]),
                    "custom_name": bool(meta["name"]),
                    "session_count": 0,
                    "last_active": None,
                }
            elif meta["name"]:
                found["name"] = meta["name"]
                found["custom_name"] = True
        return projects, sessions

    def _refresh(self, broadcast: bool, touched: Optional[dict[str, Optional[set[str]]]] = None):
        with self._scanning:
            self._rescan(broadcast, touched)

    def _rescan(self, broadcast: bool, touched: Optional[dict[str, Optional[set[str]]]]):
        from services import categories
        from services.live_sessions import registry

        try:
            new_projects, new_sessions = self._scan(touched)
        except Exception as exc:
            logger.debug(f"chat_list refresh failed: {type(exc).__name__}: {exc}")
            return
        events: list[dict] = []
        for gone in categories.prune(set(new_sessions) | registry.live_session_ids()):
            events.append({"type": "placement_removed", "session_id": gone})
        with self._lock:
            old_projects, old_sessions = self._projects, self._sessions
            new_sessions = {sid: s for sid, s in new_sessions.items() if sid not in self._hidden}
            if broadcast:
                for key, p in new_projects.items():
                    if key not in old_projects or _project_sig(p) != _project_sig(old_projects[key]):
                        events.append({"type": "project_changed", "project": p})
                for key in old_projects:
                    if key not in new_projects:
                        events.append({"type": "project_removed", "project_key": key})
                for sid, s in new_sessions.items():
                    if sid not in old_sessions or _session_sig(s) != _session_sig(old_sessions[sid]):
                        events.append({"type": "session_changed", "session": s})
                for sid in old_sessions:
                    if sid not in new_sessions:
                        events.append({"type": "session_removed", "session_id": sid})
            self._projects = new_projects
            self._sessions = new_sessions
        if events:
            self._emit(events)


hub = ChatListHub()
