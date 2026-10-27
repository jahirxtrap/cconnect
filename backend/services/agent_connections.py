"""One running process per agent and project folder, shared by every chat that talks to it."""

import asyncio
import collections
import shutil
from contextlib import suppress
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional, Protocol

import psutil

from core import packages, release
from services import acp_events, agents, persistent_sessions
from services.acp_peer import AUTH_REQUIRED, INTERNAL_ERROR, RESOURCE_NOT_FOUND, STREAM_LIMIT, AcpError, AcpPeer

PROTOCOL_VERSION = 1
ELICIT = "elicitation/create"
LOG_LINES = 400
TERMINAL_METHOD = "terminal"
LEGACY_TERMINAL_AUTH = "terminal-auth"
BATCH_SUFFIXES = (".bat", ".cmd")
CLIENT_INFO = {"name": "cconnect", "title": "CConnect", "version": release.VERSION}
CLIENT_CAPABILITIES = {
    "fs": {"readTextFile": True, "writeTextFile": True},
    "terminal": True,
    "auth": {"terminal": True},
    "elicitation": {"form": {}, "url": {}},
    "session": {"configOptions": {"boolean": {}}, "compaction": {}, "notices": {}},
    "_meta": {"terminal_output": True, LEGACY_TERMINAL_AUTH: True},
}

Ask = Callable[[dict], Awaitable[dict]]


class Receiver(Protocol):
    async def received(self, update: dict) -> None: ...

    async def requested(self, method: str, params: dict) -> Any: ...

    def dropped(self) -> None: ...


def _kill_tree(pid: int) -> None:
    try:
        root = psutil.Process(pid)
        family = [*root.children(recursive=True), root]
    except psutil.Error:
        return
    for process in family:
        with suppress(psutil.Error):
            process.kill()


def _strings(value: Any) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _env(value: Any) -> dict[str, str]:
    if isinstance(value, dict):
        return {str(key): str(item) for key, item in value.items()}
    if isinstance(value, list):
        return {str(item.get("name")): str(item.get("value") or "") for item in value if isinstance(item, dict) and item.get("name")}
    return {}


class AgentConnection:
    def __init__(self, agent: dict, cwd: str, log: collections.deque):
        self.agent = agent
        self.cwd = cwd
        self.log = log
        self.info: dict = {}
        self.users = 0
        self.auth_required = False
        self.receivers: dict[str, Receiver] = {}
        self._process: Optional[asyncio.subprocess.Process] = None
        self._peer: Optional[AcpPeer] = None
        self._tasks: list[asyncio.Task] = []
        self._login_ask: Optional[Ask] = None
        self.expiry: Optional[asyncio.Task] = None

    @property
    def alive(self) -> bool:
        return (
            self._process is not None
            and self._process.returncode is None
            and self._peer is not None
            and not self._peer.closed
        )

    @property
    def capabilities(self) -> dict:
        return self.info.get("agentCapabilities") or {}

    @property
    def session_capabilities(self) -> dict:
        return self.capabilities.get("sessionCapabilities") or {}

    @property
    def auth_methods(self) -> list[dict]:
        return [method for method in self.info.get("authMethods") or [] if isinstance(method, dict) and method.get("id")]

    async def open(self) -> None:
        argv, env = agents.launch(self.agent)
        self._process = await asyncio.create_subprocess_exec(
            *argv,
            cwd=self.cwd,
            env=env,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            limit=STREAM_LIMIT,
            creationflags=packages.NO_WINDOW,
        )
        self._peer = AcpPeer(self._process.stdout, self._process.stdin, self._requested, self._notified)
        self._tasks = [asyncio.create_task(self._serve()), asyncio.create_task(self._read_log())]
        try:
            self.info = await self._peer.call("initialize", {
                "protocolVersion": PROTOCOL_VERSION,
                "clientCapabilities": CLIENT_CAPABILITIES,
                "clientInfo": CLIENT_INFO,
            }) or {}
        except BaseException:
            await self.close()
            raise
        if self.info.get("protocolVersion") != PROTOCOL_VERSION:
            await self.close()
            raise AcpError(INTERNAL_ERROR, f"protocol version {self.info.get('protocolVersion')} is not supported")

    async def _serve(self) -> None:
        try:
            await self._peer.serve()
        finally:
            for receiver in list(self.receivers.values()):
                receiver.dropped()

    async def _read_log(self) -> None:
        stream = self._process.stderr if self._process is not None else None
        if stream is None:
            return
        while line := await stream.readline():
            self.log.append(line.decode("utf-8", errors="replace").rstrip("\r\n"))

    async def _requested(self, method: str, params: dict) -> Any:
        receiver = self.receivers.get(params.get("sessionId") or "")
        if receiver is not None:
            return await receiver.requested(method, params)
        if method == ELICIT and self._login_ask is not None:
            return acp_events.elicitation_answer(await self._login_ask(acp_events.elicitation(params)), params)
        raise AcpError(RESOURCE_NOT_FOUND, f"no session for {method}")

    async def _notified(self, method: str, params: dict) -> None:
        receiver = self.receivers.get(params.get("sessionId") or "")
        if receiver is not None and method == "session/update":
            await receiver.received(params.get("update") or {})

    async def call(self, method: str, params: dict) -> Any:
        if self._peer is None:
            raise AcpError(INTERNAL_ERROR, "the agent is not running")
        try:
            return await self._peer.call(method, params)
        except AcpError as exc:
            if exc.code == AUTH_REQUIRED:
                self.auth_required = True
            raise

    async def notify(self, method: str, params: dict) -> None:
        if self._peer is not None:
            await self._peer.notify(method, params)

    def bind(self, session_id: str, receiver: Receiver) -> None:
        self.receivers[session_id] = receiver

    def unbind(self, session_id: str) -> None:
        self.receivers.pop(session_id, None)

    def methods(self) -> list[dict]:
        """The ways to sign in this agent offers, as the app lists them."""
        return [
            {
                "id": method["id"],
                "name": str(method.get("name") or method["id"]),
                "description": str(method.get("description") or ""),
                "terminal": self.terminal_login(method["id"]) is not None,
            }
            for method in self.auth_methods
        ]

    def terminal_login(self, method_id: str) -> Optional[tuple[list[str], dict[str, str]]]:
        """The program and environment a terminal runs to sign this agent in, when the method is a terminal one."""
        method = next((item for item in self.auth_methods if item["id"] == method_id), None)
        if method is None:
            return None
        argv, env = agents.launch(self.agent)
        if Path(argv[0]).suffix.lower() in BATCH_SUFFIXES:
            return None
        if method.get("type") == TERMINAL_METHOD:
            return [*argv, *_strings(method.get("args"))], {**env, **_env(method.get("env"))}
        legacy = (method.get("_meta") or {}).get(LEGACY_TERMINAL_AUTH)
        if not isinstance(legacy, dict) or not legacy.get("command"):
            return None
        program = shutil.which(str(legacy["command"]))
        if program is None or Path(program).suffix.lower() in BATCH_SUFFIXES:
            return None
        return [program, *_strings(legacy.get("args"))], {**env, **_env(legacy.get("env"))}

    async def authenticate(self, method_id: str, ask: Ask) -> None:
        self._login_ask = ask
        try:
            await self.call("authenticate", {"methodId": method_id})
        finally:
            self._login_ask = None
        self.auth_required = False

    async def logout(self) -> None:
        await self.call("logout", {})
        self.auth_required = True

    async def close(self) -> None:
        if self._peer is not None:
            self._peer.close()
        process = self._process
        if process is not None and process.returncode is None:
            _kill_tree(process.pid)
            with suppress(ProcessLookupError):
                process.kill()
            with suppress(Exception):
                await process.wait()
        for task in self._tasks:
            task.cancel()


class ConnectionPool:
    def __init__(self):
        self._connections: dict[tuple[str, str], AgentConnection] = {}
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}
        self._logs: dict[str, collections.deque] = {}

    def log(self, agent_id: str) -> list[str]:
        return list(self._logs.get(agent_id) or [])

    def find(self, agent_id: str, cwd: str) -> Optional[AgentConnection]:
        connection = self._connections.get((agent_id, cwd))
        return connection if connection is not None and connection.alive else None

    async def take(self, agent_id: str, cwd: str) -> AgentConnection:
        key = (agent_id, cwd)
        async with self._locks.setdefault(key, asyncio.Lock()):
            connection = self._connections.get(key)
            if connection is None or not connection.alive:
                agent = agents.usable(agent_id)
                if agent is None:
                    raise agents.AgentError(agents.MISSING, agent_id)
                connection = AgentConnection(agent, cwd, self._logs.setdefault(agent_id, collections.deque(maxlen=LOG_LINES)))
                await connection.open()
                self._connections[key] = connection
            connection.users += 1
            if connection.expiry is not None:
                connection.expiry.cancel()
                connection.expiry = None
            return connection

    def give(self, connection: AgentConnection) -> None:
        connection.users -= 1
        if connection.users <= 0 and connection.expiry is None:
            connection.expiry = asyncio.create_task(self._expire(connection))

    async def _expire(self, connection: AgentConnection) -> None:
        await asyncio.sleep(persistent_sessions.grace())
        connection.expiry = None
        if connection.users > 0:
            return
        await self._retire(connection)

    async def _retire(self, connection: AgentConnection) -> None:
        key = (connection.agent["id"], connection.cwd)
        if self._connections.get(key) is connection:
            del self._connections[key]
        await connection.close()

    async def restart(self, agent_id: str) -> None:
        for connection in [item for (owner, _cwd), item in self._connections.items() if owner == agent_id]:
            await self._retire(connection)

    async def close_all(self) -> None:
        for connection in list(self._connections.values()):
            await self._retire(connection)


pool = ConnectionPool()
