"""An Agent Client Protocol session as a chat holds it: its state, its history and what the agent asks of the client."""

import asyncio
import hashlib
import json
import mimetypes
import os
import shutil
from pathlib import Path
from typing import Any, AsyncIterator, Awaitable, Callable, Optional
from urllib.parse import urlparse

from core import paths
from mcps.shared_files import listing
from services import acp_events, agents, attachments, event_rows, shared, terminal
from services.acp_peer import AUTH_REQUIRED, INVALID_PARAMS, METHOD_NOT_FOUND, RESOURCE_NOT_FOUND, AcpError
from services.agent_connections import AgentConnection, pool
from services.live_sessions import registry

CONNECTING = "connecting"
LOADING = "loading"
READY = "ready"
SIGN_IN = "auth"
FAILED = "error"
CLOSED = "closed"
LOGIN_FAILED = "login"
MISSING_SESSION = (INVALID_PARAMS, RESOURCE_NOT_FOUND)

MODE_OPTION = "mode"
SELECT = "select"
BOOLEAN = "boolean"
OUTPUT_LIMIT = 30000
STOP_REASONS = ("max_tokens", "max_turn_requests", "refusal")
STOP_SEVERITY = "warning"
CANCELLED_REASON = "cancelled"
CANCELLED = {"outcome": {"outcome": "cancelled"}}
TERMINAL_METHODS = ("terminal/create", "terminal/output", "terminal/wait_for_exit", "terminal/kill", "terminal/release")

Emit = Callable[[dict], Awaitable[Any]]
Ask = Callable[[dict], Awaitable[dict]]


def _present(capabilities: dict, key: str) -> bool:
    return capabilities.get(key) is not None


def _read(file: Path) -> dict:
    try:
        stored = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return stored if isinstance(stored, dict) else {}


def _write(file: Path, stored: dict) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(stored, ensure_ascii=False), encoding="utf-8")


def _defaults() -> dict[str, dict]:
    return _read(paths.AGENT_DEFAULTS_FILE)


def _remember(agent_id: str, **fields: list[dict]) -> None:
    stored = _defaults()
    stored[agent_id] = {**stored.get(agent_id, {}), **fields}
    _write(paths.AGENT_DEFAULTS_FILE, stored)


def _known(agent_id: str) -> dict[str, str]:
    known = _read(paths.AGENT_SESSIONS_FILE).get(agent_id)
    return {str(session_id): str(cwd) for session_id, cwd in known.items()} if isinstance(known, dict) else {}


def _set_known(agent_id: str, known: dict[str, str]) -> None:
    stored = _read(paths.AGENT_SESSIONS_FILE)
    stored[agent_id] = known
    _write(paths.AGENT_SESSIONS_FILE, stored)


def _without(agent_id: str, session_id: str) -> dict[str, str]:
    return {known: cwd for known, cwd in _known(agent_id).items() if known != session_id}


def _keep_id(connection: AgentConnection, agent_id: str, session_id: str, cwd: str) -> None:
    if session_id and not _present(connection.session_capabilities, "list"):
        _set_known(agent_id, {session_id: cwd, **_without(agent_id, session_id)})


def _choices(options: list) -> list[dict]:
    choices: list[dict] = []
    for option in options or []:
        if not isinstance(option, dict):
            continue
        if isinstance(option.get("options"), list):
            choices.extend({**choice, "group": str(option.get("name") or "")} for choice in _choices(option["options"]))
        elif option.get("value") is not None:
            choices.append({"value": str(option["value"]), "name": str(option.get("name") or option["value"]), "description": str(option.get("description") or "")})
    return choices


def _options(listed: Any) -> list[dict]:
    options: list[dict] = []
    for option in listed or []:
        if not isinstance(option, dict) or not option.get("id") or option.get("type") not in (SELECT, BOOLEAN):
            continue
        options.append({
            "id": str(option["id"]),
            "name": str(option.get("name") or ""),
            "description": str(option.get("description") or ""),
            "category": str(option.get("category") or ""),
            "type": option["type"],
            "current": option.get("currentValue"),
            "choices": _choices(option.get("options")) if option["type"] == SELECT else [],
        })
    return options


def _modes(modes: Any) -> list[dict]:
    if not isinstance(modes, dict) or not isinstance(modes.get("availableModes"), list):
        return []
    return [{
        "id": MODE_OPTION,
        "name": "",
        "description": "",
        "category": MODE_OPTION,
        "type": SELECT,
        "current": modes.get("currentModeId"),
        "choices": [
            {"value": str(mode.get("id")), "name": str(mode.get("name") or mode.get("id")), "description": str(mode.get("description") or "")}
            for mode in modes["availableModes"]
            if isinstance(mode, dict) and mode.get("id")
        ],
        "legacy": True,
    }]


def _commands(listed: Any) -> list[dict]:
    return [
        {
            "name": str(command.get("name")),
            "description": str(command.get("description") or ""),
            "kind": "prompt",
            "argument_hint": str((command.get("input") or {}).get("hint") or "") or None,
            "aliases": [],
        }
        for command in listed or []
        if isinstance(command, dict) and command.get("name")
    ]


class AgentSession:
    def __init__(self, agent_id: str, cwd: str, project_key: str, resume: Optional[str] = None):
        self.agent_id = agent_id
        self.cwd = cwd
        self.project_key = project_key
        self.session_id: Optional[str] = resume
        self.connection: Optional[AgentConnection] = None
        self.status = CONNECTING
        self.reason: Optional[str] = None
        self.detail = ""
        self.title: Optional[str] = None
        self.options: list[dict] = []
        self.commands: list[dict] = []
        self.usage: Optional[dict] = None
        self.todos: list[dict] = []
        self.rows: list[dict] = []
        self.attached: set[Path] = set()
        self.released = False
        self.reader = acp_events.UpdateReader(self._share, self._watch)
        self._replaying = False
        self._replayed: list[dict] = []
        self._turn: Optional[list[dict]] = None
        self._cancelled = asyncio.Event()
        self._emit: Optional[Emit] = None
        self._ask: Optional[Ask] = None
        self._terminals: dict[str, terminal.Terminal] = {}
        self._limits: dict[str, int] = {}
        self._opening: Optional[asyncio.Task] = None
        self._chosen: dict[str, Any] = {}
        if self._process_up():
            self.status = LOADING
            self._recall()

    def bind(self, emit: Emit, ask: Ask) -> None:
        self._emit = emit
        self._ask = ask

    def snapshot(self) -> dict:
        connection = self.connection
        capabilities = connection.capabilities if connection is not None else {}
        sessions = connection.session_capabilities if connection is not None else {}
        prompt = capabilities.get("promptCapabilities") or {}
        return {
            "type": "agent_state",
            "agent": self.agent_id,
            "status": self.status,
            "reason": self.reason,
            "detail": self.detail,
            "session_id": self.session_id,
            "title": self.title,
            "options": self.options,
            "commands": self.commands,
            "usage": self.usage,
            "methods": connection.methods() if connection is not None and self.status == SIGN_IN else [],
            "prompt": {"image": bool(prompt.get("image")), "audio": bool(prompt.get("audio")), "embedded": bool(prompt.get("embeddedContext"))},
            "sessions": {
                "list": _present(sessions, "list"),
                "load": bool(capabilities.get("loadSession")),
                "resume": _present(sessions, "resume"),
                "close": _present(sessions, "close"),
                "delete": _present(sessions, "delete"),
                "fork": _present(sessions, "fork"),
            },
            "logout": _present(capabilities.get("auth") or {}, "logout"),
            "info": (connection.info.get("agentInfo") if connection is not None else None) or None,
        }

    async def _announce(self) -> None:
        if self._emit is not None:
            await self._emit(self.snapshot())

    def _fail(self, status: str, detail: str, reason: Optional[str] = None) -> None:
        self.status = status
        self.reason = reason
        self.detail = detail

    async def open(self, resume: Optional[str] = None, signing_in: bool = False, create_now: bool = False) -> None:
        self.released = False
        self.status = LOADING if self._process_up() else CONNECTING
        self.reason, self.detail = None, ""
        await self._announce()
        try:
            connection = await self._connect()
            if resume:
                await self._resume(connection, resume)
            elif create_now or not self._recall():
                await self._create(connection)
            self.status = READY
        except AcpError as exc:
            if exc.code == AUTH_REQUIRED:
                self._fail(SIGN_IN, str(exc), LOGIN_FAILED if signing_in else None)
            else:
                self._fail(FAILED, str(exc))
        except agents.AgentError as exc:
            self._fail(FAILED, exc.detail, exc.reason)
        except OSError as exc:
            self._fail(FAILED, str(exc))
        await self._announce()
        if resume and self._emit is not None:
            await self._emit(self.history())

    def history(self) -> dict:
        return {"type": "history", "items": list(self.rows)}

    def reopen(self, signing_in: bool = False) -> None:
        if self._opening is None or self._opening.done():
            self._opening = asyncio.create_task(self.open(self.session_id, signing_in))

    async def _connect(self) -> AgentConnection:
        if self.connection is not None and self.connection.alive:
            return self.connection
        if self.connection is not None:
            pool.give(self.connection)
            self.connection = None
        self.connection = await pool.take(self.agent_id, self.cwd)
        return self.connection

    def _process_up(self) -> bool:
        return (self.connection is not None and self.connection.alive) or pool.find(self.agent_id, self.cwd) is not None

    def _recall(self) -> bool:
        remembered = _defaults().get(self.agent_id) or {}
        if not isinstance(remembered.get("options"), list):
            return False
        self.options = [{**option, "current": self._chosen.get(option["id"], option.get("current"))} for option in remembered["options"]]
        self.commands = remembered.get("commands") or []
        return True

    async def _create(self, connection: AgentConnection) -> None:
        result = await connection.call("session/new", {"cwd": self.cwd, "mcpServers": []}) or {}
        self.session_id = str(result.get("sessionId") or "")
        connection.bind(self.session_id, self)
        _keep_id(connection, self.agent_id, self.session_id, self.cwd)
        self._setup(result)
        _remember(self.agent_id, options=self.options)
        chosen, self._chosen = self._chosen, {}
        for option_id, value in chosen.items():
            await self.set_option(option_id, value)

    async def _resume(self, connection: AgentConnection, session_id: str) -> None:
        """Reopen a session, or start a new one when the agent no longer has it."""
        try:
            await self._attach(connection, session_id, replay=True)
        except AcpError as exc:
            if exc.code not in MISSING_SESSION and not await _gone(connection, self.cwd, session_id):
                raise
            connection.unbind(session_id)
            self.rows, self.todos = [], []
            await self._create(connection)

    async def _attach(self, connection: AgentConnection, session_id: str, replay: bool) -> None:
        self.session_id = session_id
        connection.bind(session_id, self)
        params = {"sessionId": session_id, "cwd": self.cwd, "mcpServers": []}
        if replay and connection.capabilities.get("loadSession"):
            self._replaying, self._replayed = True, []
            try:
                result = await connection.call("session/load", params)
            finally:
                self._replaying = False
            self.rows = event_rows.rows_of(self._replayed)
            self.todos = next((event.get("items") or [] for event in reversed(self._replayed) if event.get("type") == "todos"), [])
        elif _present(connection.session_capabilities, "resume"):
            result = await connection.call("session/resume", params)
        elif connection.capabilities.get("loadSession"):
            self._replaying = True
            try:
                result = await connection.call("session/load", params)
            finally:
                self._replaying = False
        else:
            connection.unbind(session_id)
            await self._create(connection)
            return
        self._setup(result or {})

    def _setup(self, result: dict) -> None:
        options = _options(result.get("configOptions"))
        self.options = options or _modes(result.get("modes"))

    async def _ensure(self) -> AgentConnection:
        connection = self.connection
        if connection is not None and connection.alive and self.session_id in connection.receivers:
            return connection
        connection = await self._connect()
        if self.session_id:
            await self._attach(connection, self.session_id, replay=False)
        else:
            await self._create(connection)
        self.status = READY
        await self._announce()
        return connection

    async def received(self, update: dict) -> None:
        kind = update.get("sessionUpdate")
        if kind == "config_option_update":
            self.options = _options(update.get("configOptions")) or self.options
        elif kind == "current_mode_update":
            self.options = [{**option, "current": update.get("currentModeId")} if option.get("legacy") else option for option in self.options]
        elif kind == "available_commands_update":
            self.commands = _commands(update.get("availableCommands"))
            _remember(self.agent_id, commands=self.commands)
        elif kind == "session_info_update":
            if "title" in update:
                self.title = update.get("title")
                watch.changed(self.agent_id, self.cwd)
        elif kind == "usage_update":
            self.usage = {"used": update.get("used"), "size": update.get("size"), "cost": update.get("cost")}
            if not self._replaying:
                await self._publish({"type": "context", "context_tokens": update.get("used"), "context_window": update.get("size")})
        else:
            events = await self.reader.events(update, self._replaying)
            if self._replaying:
                self._replayed.extend(events)
            else:
                for event in events:
                    await self._publish(event)
            return
        if not self._replaying:
            await self._announce()

    async def _publish(self, event: dict) -> None:
        if event.get("type") == "todos":
            self.todos = event.get("items") or []
        if self._turn is not None:
            self._turn.append(event)
        else:
            self.rows.extend(event_rows.rows_of([event]))
        if self._emit is not None:
            await self._emit(event)

    def dropped(self) -> None:
        if self._emit is None:
            return
        steady = self.status in (READY, SIGN_IN)
        self.status = CLOSED
        asyncio.get_running_loop().create_task(self._announce())
        if steady:
            self.reopen()

    def _content(self, text: str, files: list[str]) -> list[dict]:
        prompt = (self.connection.capabilities.get("promptCapabilities") or {}) if self.connection is not None else {}
        blocks: list[dict] = [{"type": "text", "text": text}] if text else []
        for relpath in files:
            path = shared.resolve_file(relpath)
            if path is None:
                continue
            self.attached.add(path.resolve())
            encoded = attachments.encode_image(path) if prompt.get("image") and attachments.is_image(path.name) else None
            if encoded:
                blocks.append({"type": "image", "mimeType": encoded[0], "data": encoded[1]})
            blocks.append({"type": "resource_link", "uri": path.as_uri(), "name": path.name, **({"mimeType": mime} if (mime := mimetypes.guess_type(path.name)[0]) else {})})
        return blocks

    async def prompt(self, text: str, files: list[str]) -> list[dict]:
        """Run one prompt turn and return the events that close it."""
        self._cancelled.clear()
        self._turn = [{"type": "user_text", "text": text}]
        try:
            connection = await self._ensure()
            result = await connection.call("session/prompt", {"sessionId": self.session_id, "prompt": self._content(text, files)}) or {}
            reason = result.get("stopReason")
            closing = [{"type": "stop", "reason": reason, "severity": STOP_SEVERITY}] if reason in STOP_REASONS else []
            self._turn.extend([{"type": "interrupted"}] if reason == CANCELLED_REASON else closing)
        except AcpError as exc:
            if exc.code == AUTH_REQUIRED:
                self._fail(SIGN_IN, str(exc))
                await self._announce()
            return [{"type": "error", "message": str(exc)}]
        except agents.AgentError as exc:
            self._fail(FAILED, exc.detail, exc.reason)
            await self._announce()
            return [{"type": "error", "message": exc.detail or exc.reason}]
        finally:
            self._commit()
        return [*closing, {"type": "result", "session_id": self.session_id, "cost_usd": None, "is_error": False}]

    def _commit(self) -> None:
        turn, self._turn = self._turn or [], None
        self.rows.extend(event_rows.rows_of(turn))
        if self.session_id:
            watch.changed(self.agent_id, self.cwd)

    async def control(self, subtype: str, _payload: dict) -> bool:
        connection = self.connection
        if subtype != "interrupt" or connection is None or not self.session_id:
            return False
        self._cancelled.set()
        await connection.notify("session/cancel", {"sessionId": self.session_id})
        return True

    async def set_option(self, option_id: str, value: Any) -> None:
        option = next((item for item in self.options if item["id"] == option_id), None)
        connection = self.connection
        if option is None or connection is None:
            return
        if not self.session_id:
            self._chosen[option_id] = value
            self.options = [{**item, "current": value} if item is option else item for item in self.options]
            await self._announce()
            return
        try:
            if option.get("legacy"):
                await connection.call("session/set_mode", {"sessionId": self.session_id, "modeId": str(value)})
                self.options = [{**item, "current": str(value)} if item is option else item for item in self.options]
            else:
                params = {"sessionId": self.session_id, "configId": option_id, "value": value}
                result = await connection.call("session/set_config_option", {**params, "type": BOOLEAN} if option["type"] == BOOLEAN else params) or {}
                self.options = _options(result.get("configOptions")) or self.options
        except AcpError as exc:
            await self._publish({"type": "api_error", "text": str(exc), "severity": "warning"})
        await self._announce()

    async def login(self, method_id: str) -> None:
        connection = self.connection
        if connection is None or self._ask is None:
            return
        try:
            await connection.authenticate(method_id, self._ask)
        except AcpError as exc:
            self._fail(SIGN_IN, str(exc), LOGIN_FAILED)
            await self._announce()
            return
        await self.open(self.session_id, signing_in=True)

    async def logout(self) -> None:
        connection = self.connection
        if connection is None:
            return
        try:
            await connection.logout()
        except AcpError as exc:
            await self._publish({"type": "api_error", "text": str(exc), "severity": "warning"})
            return
        self._fail(SIGN_IN, "")
        await self._announce()

    async def _wait(self, asked: Awaitable[dict]) -> Optional[dict]:
        answer = asyncio.ensure_future(asked)
        stop = asyncio.ensure_future(self._cancelled.wait())
        done, _ = await asyncio.wait({answer, stop}, return_when=asyncio.FIRST_COMPLETED)
        stop.cancel()
        if answer in done:
            return answer.result()
        answer.cancel()
        return None

    async def requested(self, method: str, params: dict) -> Any:
        if method == "session/request_permission":
            return await self._permission(params)
        if method == "elicitation/create":
            return await self._elicit(params)
        if method == "fs/read_text_file":
            return {"content": self._read(params)}
        if method == "fs/write_text_file":
            await self._write(params)
            return {}
        if method in TERMINAL_METHODS:
            return await self._terminal(method, params)
        raise AcpError(METHOD_NOT_FOUND, f"{method} is not supported")

    async def _permission(self, params: dict) -> dict:
        if self._ask is None:
            return CANCELLED
        payload = acp_events.permission(params, self.reader.tools)
        answer = await self._wait(self._ask(payload))
        if answer is None:
            return CANCELLED
        outcome = acp_events.permission_outcome(answer, params)
        if self._turn is not None and outcome["outcome"]["outcome"] == "selected":
            key = f"permission-{len(self._turn)}"
            self._turn.extend([
                {"type": "interaction_request", "id": key, **payload},
                {"type": "interaction_resolved", "id": key, "option_id": acp_events.resolved_id(answer.get("option_id"), payload["options"])},
            ])
        return outcome

    async def _elicit(self, params: dict) -> dict:
        if self._ask is None:
            return {"action": "cancel"}
        answer = await self._wait(self._ask(acp_events.elicitation(params)))
        return acp_events.elicitation_answer(answer, params) if answer is not None else {"action": "cancel"}

    def _path(self, raw: Any) -> Path:
        path = Path(str(raw or ""))
        if not path.is_absolute():
            raise AcpError(INVALID_PARAMS, f"{path} is not an absolute path")
        resolved = path.resolve()
        if not resolved.is_relative_to(Path(self.cwd).resolve()):
            raise AcpError(INVALID_PARAMS, f"{path} is outside {self.cwd}")
        return resolved

    def _readable(self, raw: Any) -> Path:
        """A path inside the working folder, or a file the user attached to this session."""
        path = Path(str(raw or ""))
        return path.resolve() if path.is_absolute() and path.resolve() in self.attached else self._path(raw)

    def _read(self, params: dict) -> str:
        path = self._readable(params.get("path"))
        try:
            text = path.read_bytes().decode("utf-8", errors="replace")
        except FileNotFoundError:
            raise AcpError(RESOURCE_NOT_FOUND, f"{path} does not exist") from None
        line, limit = params.get("line"), params.get("limit")
        if not isinstance(line, int) and not isinstance(limit, int):
            return text
        lines = text.splitlines(keepends=True)
        start = max(line - 1, 0) if isinstance(line, int) else 0
        return "".join(lines[start:start + limit] if isinstance(limit, int) else lines[start:])

    async def _write(self, params: dict) -> None:
        path = self._path(params.get("path"))
        content = str(params.get("content") or "")
        old = path.read_bytes().decode("utf-8", errors="replace") if path.is_file() else ""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content.encode("utf-8"))
        for event in self.reader.written(str(path), old, content):
            await self._publish(event)

    async def _terminal(self, method: str, params: dict) -> dict:
        if method == "terminal/create":
            return self._spawn(params)
        held = self._terminals.get(str(params.get("terminalId") or ""))
        if held is None:
            raise AcpError(RESOURCE_NOT_FOUND, "no such terminal")
        if method == "terminal/output":
            return self._output(held)
        if method == "terminal/wait_for_exit":
            await held.exited.wait()
            return {"exitCode": held.exit_status, "signal": None}
        held.close()
        if method == "terminal/release":
            self._terminals.pop(held.id, None)
            self._limits.pop(held.id, None)
        return {}

    def _spawn(self, params: dict) -> dict:
        command = str(params.get("command") or "")
        program = shutil.which(command) or command
        env = {**os.environ, **{str(item.get("name")): str(item.get("value") or "") for item in params.get("env") or [] if isinstance(item, dict) and item.get("name")}}
        cwd = str(self._path(params["cwd"])) if params.get("cwd") else self.cwd
        try:
            held = terminal.spawn([cwd], command, argv=[program, *[str(arg) for arg in params.get("args") or []]], env=env)
        except (OSError, ValueError) as exc:
            raise AcpError(INVALID_PARAMS, str(exc)) from None
        self._terminals[held.id] = held
        if isinstance(params.get("outputByteLimit"), int):
            self._limits[held.id] = params["outputByteLimit"]
        return {"terminalId": held.id}

    def _output(self, held: terminal.Terminal) -> dict:
        data = held.tail(0).encode("utf-8")
        limit = self._limits.get(held.id)
        truncated = held.overflowed or (limit is not None and len(data) > limit)
        if limit is not None and len(data) > limit:
            data = data[-limit:]
        exited = {"exitStatus": {"exitCode": held.exit_status, "signal": None}} if not held.alive else {}
        return {"output": data.decode("utf-8", errors="ignore"), "truncated": truncated, **exited}

    def _watch(self, tool_id: str, terminal_id: str) -> None:
        held = self._terminals.get(terminal_id)
        if held is not None:
            asyncio.get_running_loop().create_task(self._follow(tool_id, held))

    async def _follow(self, tool_id: str, held: terminal.Terminal) -> None:
        _, queue = held.attach(0, 0)
        try:
            running = True
            while running:
                running = await queue.get() is not None
                while running and not queue.empty():
                    running = queue.get_nowait() is not None
                await self._publish({"type": "tool_result", "tool_use_id": tool_id, "content": held.tail(OUTPUT_LIMIT)})
        finally:
            held.detach(queue)

    async def _share(self, data: bytes, mime: str, uri: str) -> Optional[dict]:
        suffix = Path(urlparse(uri).path).suffix if uri else mimetypes.guess_extension(mime) or ""
        name = f"agent-{hashlib.sha256(data).hexdigest()[:16]}{suffix}"
        target = shared.project_dir(self.project_key) / name
        if not target.exists():
            await asyncio.to_thread(target.write_bytes, data)
        found = listing({"paths": [name]}, self.project_key)
        return found[0] if found else None

    @property
    def holding(self) -> bool:
        return self.connection is not None

    async def release(self, linger: bool = True) -> None:
        for held in self._terminals.values():
            held.close()
        self._terminals.clear()
        self._limits.clear()
        connection, self.connection = self.connection, None
        self._emit = None
        self._ask = None
        self.released = True
        if connection is not None:
            if self.session_id:
                connection.unbind(self.session_id)
            pool.give(connection, linger)


def runner(live: Any, session: AgentSession, text: str, files: list[str], seed_id: Optional[str]):
    """The work a chat runs for one prompt and for the ones queued behind it."""

    def factory(_ask_user, _emit):
        async def turns():
            item: Optional[dict] = {"id": seed_id, "text": text, "attachments": files}
            while item is not None:
                yield {
                    "type": "dequeued",
                    "ids": [item["id"]] if item.get("id") else [],
                    "text": item["text"],
                    "consumed": 0,
                }
                live.set_transport(session)
                for event in await session.prompt(item["text"], item.get("attachments") or []):
                    yield event
                item = await live.take_queued()
                if item is not None:
                    await live.commit_user(item["id"], item["text"])

        return turns()

    return factory


async def _listed(connection: AgentConnection, cwd: str) -> AsyncIterator[dict]:
    cursor: Optional[str] = None
    while True:
        result = await connection.call("session/list", {"cwd": cwd, **({"cursor": cursor} if cursor else {})}) or {}
        for item in result.get("sessions") or []:
            if isinstance(item, dict) and item.get("sessionId"):
                yield item
        following = result.get("nextCursor")
        if not following or following == cursor:
            return
        cursor = following


async def _gone(connection: AgentConnection, cwd: str, session_id: str) -> bool:
    if not _present(connection.session_capabilities, "list"):
        return False
    try:
        async for item in _listed(connection, cwd):
            if item["sessionId"] == session_id:
                return False
    except AcpError:
        return False
    return True


def _activity(session_id: str) -> Optional[str]:
    live = registry.get_by_session(session_id)
    return live.activity if live else None


async def all_sessions(agent_id: str, cwd: str) -> list[dict]:
    connection = await pool.take(agent_id, cwd)
    try:
        if _present(connection.session_capabilities, "list"):
            return [
                {
                    "session_id": str(item["sessionId"]),
                    "title": item.get("title"),
                    "updated_at": item.get("updatedAt"),
                    "cwd": item.get("cwd"),
                    "activity": _activity(str(item["sessionId"])),
                }
                async for item in _listed(connection, cwd)
            ]
        if not (connection.capabilities.get("loadSession") or _present(connection.session_capabilities, "resume")):
            return []
        return [
            {"session_id": session_id, "title": None, "updated_at": None, "cwd": cwd, "activity": _activity(session_id)}
            for session_id, folder in _known(agent_id).items()
            if folder == cwd
        ]
    finally:
        pool.give(connection)


async def forget(agent_id: str, cwd: str, session_id: str) -> None:
    """Delete a session the agent keeps, along with what this server kept of it."""
    connection = await pool.take(agent_id, cwd)
    try:
        if _present(connection.session_capabilities, "delete"):
            await connection.call("session/delete", {"sessionId": session_id})
    finally:
        pool.give(connection)
    if session_id in _known(agent_id):
        _set_known(agent_id, _without(agent_id, session_id))
    watch.changed(agent_id, cwd)


async def fork(agent_id: str, cwd: str, session_id: str) -> str:
    connection = await pool.take(agent_id, cwd)
    try:
        result = await connection.call("session/fork", {"sessionId": session_id, "cwd": cwd, "mcpServers": []}) or {}
        forked = str(result.get("sessionId") or "")
        _keep_id(connection, agent_id, forked, cwd)
    finally:
        pool.give(connection)
    watch.changed(agent_id, cwd)
    return forked


async def _snapshot(agent_id: str, cwd: str) -> dict:
    try:
        listed = await all_sessions(agent_id, cwd)
    except (AcpError, agents.AgentError, OSError):
        listed = None
    return {"type": "sessions", "agent": agent_id, "cwd": cwd, "sessions": listed}


class SessionsWatch:
    def __init__(self):
        self._watching: dict[asyncio.Queue, tuple[str, str]] = {}

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._watching[queue] = ("", "")
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._watching.pop(queue, None)

    def watch(self, queue: asyncio.Queue, agent_id: str, cwd: str) -> None:
        if queue in self._watching and agent_id and cwd:
            self._watching[queue] = (agent_id, cwd)
            asyncio.get_running_loop().create_task(self._push(agent_id, cwd, [queue]))

    def changed(self, agent_id: str, cwd: str) -> None:
        watching = [queue for queue, key in self._watching.items() if key == (agent_id, cwd)]
        if watching:
            asyncio.get_running_loop().create_task(self._push(agent_id, cwd, watching))

    def activity(self, agent_id: str, cwd: str, session_id: str, activity: Optional[str]) -> None:
        update = {"type": "activity", "agent": agent_id, "cwd": cwd, "session_id": session_id, "activity": activity}
        for queue, key in self._watching.items():
            if key == (agent_id, cwd):
                queue.put_nowait(update)

    async def _push(self, agent_id: str, cwd: str, queues: list[asyncio.Queue]) -> None:
        snapshot = await _snapshot(agent_id, cwd)
        for queue in queues:
            if self._watching.get(queue) == (agent_id, cwd):
                queue.put_nowait(snapshot)


watch = SessionsWatch()
