"""Live chat/project list updates over a dedicated WebSocket.

A filesystem watcher (``watchdog``, with a polling fallback when it is missing or
fails) over the Claude projects directory keeps a lightweight in-memory snapshot of
the session/project list. On any change it re-scans, reusing cached metadata for
files whose (mtime, size) is unchanged, diffs against the snapshot and broadcasts
only the per-item deltas to subscribed clients — so the app loads the list once and
stays fresh without re-fetching everything.
"""

import asyncio
import threading
from pathlib import Path
from typing import Optional

from loguru import logger

from core.config import CLAUDE_PROJECTS_DIR
from services import sessions as sessions_service

_DEBOUNCE_SECONDS = 0.5
_POLL_SECONDS = 2.0


def _session_sig(s: dict) -> tuple:
    return (s.get("title"), s.get("color"), s.get("preview"), s.get("last_active"),
            s.get("size"), s.get("path"), s.get("project_key"), s.get("activity"))


def _project_sig(p: dict) -> tuple:
    return (p.get("path"), p.get("name"), p.get("session_count"), p.get("last_active"))


class ChatListHub:
    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._activity: dict[str, str] = {}
        self._projects: dict[str, dict] = {}
        self._sig_cache: dict[str, tuple] = {}
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._pending = threading.Event()
        self._stop = threading.Event()
        self._observer = None
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
        self._pending.set()
        if self._observer is not None:
            try:
                self._observer.stop()
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._subscribers.discard(q)

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "type": "snapshot",
                "projects": list(self._projects.values()),
                "sessions": list(self._sessions.values()),
            }

    def projects(self) -> list[dict]:
        with self._lock:
            return list(self._projects.values())

    def sessions(self) -> list[dict]:
        with self._lock:
            return list(self._sessions.values())

    def set_activity(self, session_id: Optional[str], activity: Optional[str]):
        if not session_id:
            return
        with self._lock:
            if activity:
                self._activity[session_id] = activity
            else:
                self._activity.pop(session_id, None)
            entry = self._sessions.get(session_id)
            if entry is None or entry.get("activity") == activity:
                return
            entry = {**entry, "activity": activity} if activity else {k: v for k, v in entry.items() if k != "activity"}
            self._sessions[session_id] = entry
        self._emit([{"type": "session_changed", "session": entry}])

    def restore_activity(self, session_id: Optional[str]):
        from services.live_sessions import registry

        live = registry.get_by_session(session_id)
        self.set_activity(session_id, live.activity if live else None)

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
        base = CLAUDE_PROJECTS_DIR
        handler = None
        if Path(base).is_dir():
            try:
                from watchdog.events import FileSystemEventHandler
                from watchdog.observers import Observer

                hub = self

                class _Handler(FileSystemEventHandler):
                    def on_any_event(self, event):
                        hub._pending.set()

                observer = Observer()
                observer.schedule(_Handler(), base, recursive=True)
                observer.daemon = True
                observer.start()
                self._observer = observer
                handler = "watchdog"
            except Exception as exc:
                logger.info(f"chat_list: watchdog unavailable ({exc}); falling back to polling")
        if handler == "watchdog":
            threading.Thread(target=self._debounce_loop, name="chat-list-watch", daemon=True).start()
        else:
            threading.Thread(target=self._poll_loop, name="chat-list-poll", daemon=True).start()

    def _debounce_loop(self):
        while not self._stop.is_set():
            self._pending.wait()
            if self._stop.is_set():
                return
            self._stop.wait(_DEBOUNCE_SECONDS)
            self._pending.clear()
            self._refresh(True)

    def _poll_loop(self):
        while not self._stop.is_set():
            self._stop.wait(_POLL_SECONDS)
            if self._stop.is_set():
                return
            self._refresh(True)

    def _scan(self) -> tuple[dict, dict]:
        base = Path(CLAUDE_PROJECTS_DIR)
        projects: dict[str, dict] = {}
        sessions: dict[str, dict] = {}
        seen: set[str] = set()
        if not base.is_dir():
            return projects, sessions
        ai_key = sessions_service._AI_PROJECT_KEY
        for directory in base.iterdir():
            if not directory.is_dir() or directory.name == ai_key:
                continue
            pkey = directory.name
            count = 0
            newest_mtime: Optional[float] = None
            newest_file: Optional[Path] = None
            newest_meta: Optional[dict] = None
            for file in directory.glob("*.jsonl"):
                try:
                    st = file.stat()
                except OSError:
                    continue
                count += 1
                sid = file.stem
                seen.add(sid)
                sig = (st.st_mtime, st.st_size)
                cached = self._sig_cache.get(sid)
                if cached is not None and cached[0] == sig:
                    meta = cached[1]
                else:
                    cwd, preview, title, color, entrypoint, has_content = sessions_service._session_meta(file)
                    if entrypoint != "cli" or (not has_content and not title):
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
                if meta is not None:
                    activity = self._activity.get(sid)
                    if activity:
                        meta = {**meta, "activity": activity}
                    sessions[sid] = meta
                if newest_mtime is None or st.st_mtime > newest_mtime:
                    newest_mtime = st.st_mtime
                    newest_file = file
                    newest_meta = meta
            if count and newest_file is not None:
                path = newest_meta["path"] if newest_meta else sessions_service._read_cwd(newest_file)
                projects[pkey] = {
                    "project_key": pkey,
                    "path": path,
                    "name": sessions_service._project_name(path),
                    "session_count": count,
                    "last_active": newest_mtime,
                }
        if len(self._sig_cache) > len(seen):
            self._sig_cache = {k: v for k, v in self._sig_cache.items() if k in seen}
        return projects, sessions

    def _refresh(self, broadcast: bool):
        try:
            new_projects, new_sessions = self._scan()
        except Exception as exc:
            logger.debug(f"chat_list refresh failed: {type(exc).__name__}: {exc}")
            return
        events: list[dict] = []
        with self._lock:
            old_projects, old_sessions = self._projects, self._sessions
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
