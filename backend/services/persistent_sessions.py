"""CLI processes kept connected between turns, and the settings that govern them."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Optional

from loguru import logger

from services import mods, settings_store, visibility

CLOSE_TIMEOUT = 20.0
OWN_TURN_TIMEOUT = 300.0
_TURN_MESSAGES = frozenset({"AssistantMessage", "UserMessage", "StreamEvent"})


class TurnBinding:
    def __init__(self, emit, ask_user, wanted, request_compact, session_info, status):
        self.emit = emit
        self.ask_user = ask_user
        self.wanted = wanted
        self.request_compact = request_compact
        self.session_info = session_info
        self.status = status


class PersistentSession:
    def __init__(self, shape: dict):
        self.shape = shape
        self.mark: Optional[dict] = None
        self.client: Any = None
        self.inbox: Optional[asyncio.Queue] = None
        self.turn: Optional[TurnBinding] = None
        self.listener: Optional[Callable[[dict], Awaitable[None]]] = None
        self.answerer: Optional[mods.Answerer] = None
        self.changed: Optional[Callable[[], None]] = None
        self._reader: Optional[asyncio.Task] = None
        self._owner: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._idle = asyncio.Event()
        self._idle.set()
        self._own_turn = False

    @property
    def connected(self) -> bool:
        return self.client is not None

    def bind(self, turn: TurnBinding) -> None:
        self.turn = turn

    def unbind(self) -> None:
        self.turn = None

    async def emit(self, event: dict) -> None:
        turn = self.turn
        if turn is not None and turn.emit is not None:
            await turn.emit(event)

    async def ask_user(self, payload: dict) -> dict:
        turn = self.turn
        if turn is None or turn.ask_user is None:
            return {"behavior": "deny", "message": "no client attached"}
        return await turn.ask_user(payload)

    def wanted(self) -> dict:
        turn = self.turn
        if turn is None or turn.wanted is None:
            return visibility.defaults()
        return turn.wanted()

    def request_compact(self, reason: str) -> None:
        turn = self.turn
        if turn is not None and turn.request_compact is not None:
            turn.request_compact(reason)

    def session_info(self) -> dict:
        turn = self.turn
        if turn is None or turn.session_info is None:
            return {}
        return turn.session_info()

    def status(self) -> dict:
        turn = self.turn
        return turn.status if turn is not None and turn.status is not None else {}

    async def connect(self, options: Any) -> None:
        ready: asyncio.Future = asyncio.get_running_loop().create_future()
        self._stop = asyncio.Event()
        self._owner = asyncio.create_task(self._own(options, ready))
        await ready

    async def _own(self, options: Any, ready: asyncio.Future) -> None:
        from claude_agent_sdk import ClaudeSDKClient

        try:
            async with ClaudeSDKClient(options=options) as client:
                self.client = client
                self.inbox = asyncio.Queue()
                if not ready.done():
                    ready.set_result(None)
                self._changed()
                await self._stop.wait()
        except BaseException as exc:
            if not ready.done():
                ready.set_exception(exc)
            elif not isinstance(exc, asyncio.CancelledError):
                logger.warning(f"persistent session ended: {type(exc).__name__}: {exc}")
        finally:
            self.client = None
            self._changed()

    def _changed(self) -> None:
        if self.changed is not None:
            self.changed()

    def listen(self) -> asyncio.Queue:
        """The client's messages, read once and shared by every turn on this session."""
        if self._reader is None or self._reader.done():
            self._reader = asyncio.create_task(self._pump(self.client, self.inbox, self._stop))
        return self.inbox

    async def attach_surface(self) -> None:
        if not mods.enabled() or not await mods.attach(self.client):
            return
        mods.serve(self.client, self._answer)
        await self._notify({"type": "mod_surface", "attached": True})
        roster = await mods.panes(self.client)
        if roster is not None:
            await self._notify(roster)
        info = await self.client.get_server_info()
        await self._notify(mods.commands((info or {}).get("commands")))

    async def _answer(self, subtype: str, data: dict) -> Optional[dict]:
        answerer = self.answerer
        return await answerer(subtype, data) if answerer is not None else None

    async def _notify(self, event: dict) -> None:
        listener = self.listener
        if listener is None:
            return
        try:
            await listener(event)
        except Exception as exc:
            logger.warning(f"mod event dropped: {type(exc).__name__}: {exc}")

    async def settle(self) -> None:
        """Wait out a turn the CLI started on its own that nobody adopted and drop what no turn read."""
        try:
            await asyncio.wait_for(self._idle.wait(), OWN_TURN_TIMEOUT)
        except asyncio.TimeoutError:
            logger.warning("the CLI's own turn did not end; writing the next one anyway")
        inbox = self.inbox
        while inbox is not None and not inbox.empty():
            if inbox.get_nowait() is None:
                inbox.put_nowait(None)
                return

    async def _pump(self, client: Any, inbox: asyncio.Queue, stop: asyncio.Event) -> None:
        try:
            async for message in client.receive_messages():
                if mods.handles(message):
                    for event in mods.events(message.subtype, message.data):
                        await self._notify(event)
                    continue
                kind = type(message).__name__
                if kind == "ResultMessage":
                    self._idle.set()
                elif self.turn is None and kind in _TURN_MESSAGES and not self._own_turn:
                    self._own_turn = True
                    self._idle.clear()
                    await self._notify({"type": "own_turn"})
                if self.turn is not None or self._own_turn:
                    await inbox.put(message)
                if kind == "ResultMessage":
                    self._own_turn = False
        except BaseException:
            pass
        finally:
            self._idle.set()
            stop.set()
            await inbox.put(None)
            await self._notify({"type": "mod_surface", "attached": False})

    async def close(self) -> None:
        self.turn = None
        self.mark = None
        owner = self._owner
        self._owner = None
        self.client = None
        if owner is None:
            return
        self._stop.set()
        done, _ = await asyncio.wait({owner}, timeout=CLOSE_TIMEOUT)
        if not done:
            logger.warning("persistent session did not close within the grace window")


def enabled() -> bool:
    return bool(settings_store.get("persistent_sessions"))


def grace() -> float:
    return max(float(settings_store.get("persistent_grace") or 0), 0.0)


def limit() -> int:
    return max(int(settings_store.get("persistent_limit") or 1), 1)


def shape_of(cwd: str, account: Optional[str], scope_id: str) -> dict:
    return {"cwd": cwd or "", "account": account or "", "scope": scope_id or ""}


class SessionPool:
    def __init__(self):
        self._sessions: dict[str, PersistentSession] = {}

    def get(self, key: str) -> Optional[PersistentSession]:
        return self._sessions.get(key)

    def keys(self) -> list[str]:
        return list(self._sessions)

    async def take(self, key: str, shape: dict) -> PersistentSession:
        session = self._sessions.get(key)
        if session is not None and session.shape != shape:
            await self.drop(key)
            session = None
        if session is None:
            session = PersistentSession(shape)
            self._sessions[key] = session
        return session

    async def drop(self, key: str) -> bool:
        session = self._sessions.pop(key, None)
        if session is None:
            return False
        await session.close()
        return True

    async def close_all(self) -> None:
        for key in list(self._sessions):
            await self.drop(key)

    async def trim(self, limit: int, keep: set[str]) -> None:
        extra = [key for key in self._sessions if key not in keep]
        while len(self._sessions) > max(limit, len(keep)) and extra:
            await self.drop(extra.pop(0))


pool = SessionPool()
