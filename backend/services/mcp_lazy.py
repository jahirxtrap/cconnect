"""Local MCP servers a chat's CLI reaches through the backend, each started the first time the chat uses it."""

from __future__ import annotations

import asyncio
import dataclasses
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import uuid
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

import anyio
import anyio.abc
import mcp.types as types
import psutil
from loguru import logger
from mcp import ClientSession, StdioServerParameters, stdio_client
from mcp.client.session import ClientRequestContext
from mcp.server.context import ServerRequestContext
from mcp.server.lowlevel.server import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.shared.exceptions import MCPError
from mcp.shared.message import ServerMessageMetadata
from mcp_types.version import HANDSHAKE_PROTOCOL_VERSIONS
from pydantic import TypeAdapter

from core.config import PORT
from core.db import Session
from core.models import McpCatalog
from services import accounts, claude_assets

PATH = "/api/mcp/lazy"
SPAWN_MARKER = "CCONNECT_MCP_SPAWN"

_SOURCES = frozenset({"user", "local", "plugin"})
_PLACEHOLDER = re.compile(r"\$\{([^}]*)\}")
_FALLBACK = ":-"
_CLI_DROPPED = ("CLAUDE_CODE_SDK_READS_SESSION_STATE", "OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE")
_SDK_ENV = {"CLAUDE_CODE_ENTRYPOINT": "sdk-py"}
_ENTRY_KEYS = ("timeout",)
_LISTS = {"tools": "tools/list", "prompts": "prompts/list", "resources": "resources/list", "resourceTemplates": "resources/templates/list"}
_FORWARDED = {
    "tools/call": types.CallToolRequestParams,
    "prompts/get": types.GetPromptRequestParams,
    "resources/read": types.ReadResourceRequestParams,
    "resources/subscribe": types.SubscribeRequestParams,
    "resources/unsubscribe": types.UnsubscribeRequestParams,
    "completion/complete": types.CompleteRequestParams,
}
_LOG_LEVEL = "logging/setLevel"
_VERSION_HEADER = b"mcp-protocol-version"
_UNSUPPORTED_VERSION = json.dumps({
    "jsonrpc": "2.0",
    "id": None,
    "error": {"code": types.INVALID_REQUEST, "message": f"Unsupported protocol version; supported: {', '.join(HANDSHAKE_PROTOCOL_VERSIONS)}"},
}).encode()
_RAW = TypeAdapter(dict[str, Any])
_LAUNCHERS = frozenset({"uvx", "uv", "npx", "npm", "pnpm", "bunx", "cmd", "conhost", "sh", "bash"})
_LAUNCHER_SCRIPTS = ("npx-cli.js", "npm-cli.js", "pnpm.cjs")
_CONSOLE_HOST = "conhost"
_MAX_BODY = 64 * 1024 * 1024
_BUILDS = asyncio.Semaphore(2)


@dataclass(frozen=True, eq=False)
class Spec:
    name: str
    command: str
    args: tuple[str, ...]
    env: dict[str, str]
    entry: dict[str, Any]
    key: str


@dataclass
class Launch:
    command: str
    args: tuple[str, ...]
    env: dict[str, str] = field(default_factory=dict)


_catalogs: dict[str, dict[str, Any]] = {}
_direct: dict[str, Launch] = {}
_building: set[str] = set()
_served: dict[str, "_Served"] = {}
_links: set["_Link"] = set()


def _expand(text: str, known: dict[str, str]) -> Optional[str]:
    missing: list[str] = []

    def value(match: re.Match) -> str:
        name, separator, fallback = match.group(1).partition(_FALLBACK)
        if name in known:
            return known[name]
        if separator:
            return fallback
        missing.append(name)
        return ""

    expanded = _PLACEHOLDER.sub(value, text)
    return None if missing else expanded


def _plugin_vars(plugin: Optional[dict]) -> dict[str, str]:
    if not plugin:
        return {}
    data = accounts.primary_dir() / "plugins" / "data" / f"{plugin['name']}-{plugin['marketplace']}"
    return {"CLAUDE_PLUGIN_ROOT": str(plugin["install_path"]), "CLAUDE_PLUGIN_DATA": str(data)}


def _specs(cwd: str, env: dict[str, str]) -> list[Spec]:
    specs = []
    for server in claude_assets.declared_mcp(cwd):
        cfg = server.config
        if server.source not in _SOURCES or not server.enabled or server.muted:
            continue
        if (cfg.get("type") or "stdio") != "stdio" or not isinstance(cfg.get("command"), str):
            continue
        plugin = _plugin_vars(server.plugin)
        known = {**env, **plugin}
        command = _expand(cfg["command"], known)
        args = [_expand(str(arg), known) for arg in cfg.get("args") or []]
        own = {str(name): _expand(str(value), known) for name, value in (cfg.get("env") or {}).items()}
        if command is None or None in args or None in own.values():
            continue
        key = hashlib.sha256(json.dumps([server.name, command, args, own, plugin], sort_keys=True).encode()).hexdigest()
        entry = {name: cfg[name] for name in _ENTRY_KEYS if name in cfg}
        specs.append(Spec(server.name, command, tuple(args), {**plugin, **own}, entry, key))
    return specs


def _load_catalogs(keys: list[str]) -> None:
    wanted = [key for key in keys if key not in _catalogs]
    if not wanted:
        return
    with Session() as session:
        for row in session.query(McpCatalog).filter(McpCatalog.key.in_(wanted)):
            _catalogs[row.key] = row.catalog


def _store(spec: Spec, catalog: dict[str, Any]) -> None:
    _catalogs[spec.key] = catalog
    with Session() as session:
        session.query(McpCatalog).filter(McpCatalog.name == spec.name, McpCatalog.key != spec.key).delete()
        session.merge(McpCatalog(key=spec.key, name=spec.name, catalog=catalog, updated_at=datetime.now(timezone.utc)))
        session.commit()


def _spawn_env(base: dict[str, str], spec: Spec, cwd: str, session_id: Optional[str]) -> dict[str, str]:
    env = {name: value for name, value in base.items() if name not in _CLI_DROPPED}
    env.update(CLAUDECODE="1", CLAUDE_PROJECT_DIR=cwd)
    if session_id:
        env["CLAUDE_CODE_SESSION_ID"] = session_id
    env.update(spec.env)
    return env


def _short_name(process: psutil.Process) -> str:
    return process.name().lower().removesuffix(".exe")


def _is_launcher(process: psutil.Process) -> bool:
    name = _short_name(process)
    if name in _LAUNCHERS:
        return True
    return name == "node" and any(part.endswith(_LAUNCHER_SCRIPTS) for part in process.cmdline()[1:2])


def _launched(marker: str) -> Optional[Launch]:
    """What a launcher ended up running: the first process below it that is not one itself."""
    try:
        tree = psutil.Process().children(recursive=True)
    except psutil.Error:
        return None
    marked: dict[int, psutil.Process] = {}
    for process in tree:
        with suppress(psutil.Error):
            if process.environ().get(SPAWN_MARKER) == marker:
                marked[process.pid] = process
    try:
        roots = [process for process in marked.values() if process.ppid() not in marked]
        if len(roots) != 1:
            return None
        node = roots[0]
        while _is_launcher(node):
            below = [child for child in node.children() if child.pid in marked and _short_name(child) != _CONSOLE_HOST]
            if len(below) != 1:
                return None
            node = below[0]
        if node is roots[0]:
            return None
        with node.oneshot():
            return Launch(node.exe(), tuple(node.cmdline()[1:]), node.environ())
    except psutil.Error:
        return None


def _wire(model: Any) -> dict[str, Any]:
    return model.model_dump(by_alias=True, mode="json", exclude_none=True)


async def _read_lists(session: ClientSession, capabilities: types.ServerCapabilities) -> dict[str, Any]:
    offered = {
        "tools": capabilities.tools is not None,
        "prompts": capabilities.prompts is not None,
        "resources": capabilities.resources is not None,
        "resourceTemplates": capabilities.resources is not None,
    }
    lists: dict[str, Any] = {}
    for key, method in _LISTS.items():
        items: list[Any] = []
        cursor = None
        while offered[key]:
            params = {"cursor": cursor} if cursor else None
            try:
                page = await session.send_request(types.Request[dict[str, Any] | None, str](method=method, params=params), _RAW)
            except MCPError as exc:
                if exc.error.code != types.METHOD_NOT_FOUND:
                    raise
                break
            items.extend(page.get(key) or [])
            cursor = page.get("nextCursor")
            if not cursor:
                break
        lists[key] = items
    return lists


class _Upstream:
    """The real server process and its client session, owned by one task from start to close."""

    def __init__(self, spec: Spec, env: dict[str, str], cwd: str, link: Optional["_Link"] = None):
        self.spec = spec
        self.env = env
        self.cwd = cwd
        self.link = link
        self.session: Optional[ClientSession] = None
        self.initialized: Optional[types.InitializeResult] = None
        self.error: Optional[BaseException] = None
        self.ready = anyio.Event()
        self.stop = anyio.Event()
        self.done = anyio.Event()

    def _params(self) -> tuple[StdioServerParameters, Optional[str]]:
        direct = _direct.get(self.spec.key)
        if direct is not None and Path(direct.command).is_file():
            env = {**self.env, **direct.env}
            return StdioServerParameters(command=direct.command, args=list(direct.args), env=env, cwd=self.cwd, encoding_error_handler="replace"), None
        marker = uuid.uuid4().hex
        env = {**self.env, SPAWN_MARKER: marker}
        return StdioServerParameters(command=self.spec.command, args=list(self.spec.args), env=env, cwd=self.cwd, encoding_error_handler="replace"), marker

    def _callbacks(self) -> dict[str, Any]:
        link = self.link
        if link is None:
            return {}
        caps = link.connection.client_capabilities or types.ClientCapabilities()
        out: dict[str, Any] = {"logging_callback": link.on_log, "message_handler": link.on_message}
        if caps.elicitation is not None:
            out["elicitation_callback"] = link.on_elicit
        if caps.sampling is not None:
            out["sampling_callback"] = link.on_sample
            out["sampling_capabilities"] = caps.sampling
        if caps.roots is not None:
            out["list_roots_callback"] = link.on_roots
        return out

    async def run(self) -> None:
        params, marker = self._params()
        try:
            with open(os.devnull, "w", encoding="utf-8") as errlog:
                async with stdio_client(params, errlog=errlog) as (read, write):
                    async with ClientSession(read, write, **self._callbacks()) as session:
                        self.initialized = await session.initialize()
                        if marker is not None:
                            launched = await asyncio.to_thread(_launched, marker)
                            if launched is not None:
                                spawned = params.env or {}
                                delta = {
                                    name: value for name, value in launched.env.items()
                                    if name != SPAWN_MARKER and spawned.get(name) != value
                                }
                                _direct[self.spec.key] = Launch(launched.command, launched.args, delta)
                        self.session = session
                        self.ready.set()
                        await self.stop.wait()
        except BaseException as exc:
            self.error = exc
            if marker is None:
                _direct.pop(self.spec.key, None)
            if not isinstance(exc, Exception):
                raise
        finally:
            self.session = None
            self.ready.set()
            self.done.set()

    async def request(self, method: str, params: Optional[dict[str, Any]], progress: Any = None) -> dict[str, Any]:
        if self.session is None:
            raise MCPError(code=types.INTERNAL_ERROR, message=f"{self.spec.name} is not running")
        request = types.Request[dict[str, Any] | None, str](method=method, params=params)
        return await self.session.send_request(request, _RAW, progress_callback=progress)

    async def close(self) -> None:
        self.stop.set()
        with anyio.CancelScope(shield=True):
            await self.done.wait()


class _Link:
    """One CLI session on one server: the process it starts on first use and the messages that flow back."""

    def __init__(self, served: "_Served", connection: Any):
        self.served = served
        self.connection = connection
        self.inflight: list[ServerRequestContext] = []
        self.upstream: Optional[_Upstream] = None
        self.level: Optional[str] = None
        self.used_at = time.monotonic()
        self.lock = anyio.Lock()

    async def ensure(self) -> _Upstream:
        async with self.lock:
            if self.upstream is not None and self.upstream.session is not None:
                return self.upstream
            direct = self.served.spec.key in _direct
            upstream = await self._start()
            if upstream.session is None and direct:
                upstream = await self._start()
            if upstream.session is None:
                raise MCPError(code=types.INTERNAL_ERROR, message=f"{self.served.spec.name} failed to start: {upstream.error!r}")
            self.upstream = upstream
            if self.level is not None:
                await upstream.request(_LOG_LEVEL, {"level": self.level})
        try:
            await self._settle(upstream)
        except Exception as exc:
            logger.debug(f"{self.served.spec.name}: catalog not refreshed: {type(exc).__name__}: {exc}")
        return upstream

    async def _start(self) -> _Upstream:
        served = self.served
        upstream = _Upstream(served.spec, served.env(), served.cwd, self)
        served.group.start_soon(upstream.run)
        await upstream.ready.wait()
        return upstream

    async def _settle(self, upstream: _Upstream) -> None:
        initialized = upstream.initialized
        if initialized is None or upstream.session is None:
            return
        lists = await _read_lists(upstream.session, initialized.capabilities)
        fresh = {"initialize": _wire(initialized), **lists}
        current = self.served.catalog
        if fresh == current:
            return
        await asyncio.to_thread(_store, self.served.spec, fresh)
        if lists.get("tools") != current.get("tools"):
            await self.connection.send_tool_list_changed()
        if lists.get("prompts") != current.get("prompts"):
            await self.connection.send_prompt_list_changed()
        if lists.get("resources") != current.get("resources") or lists.get("resourceTemplates") != current.get("resourceTemplates"):
            await self.connection.send_resource_list_changed()

    async def stop_upstream(self) -> None:
        async with self.lock:
            upstream, self.upstream = self.upstream, None
        if upstream is not None:
            await upstream.close()

    async def close(self) -> None:
        _links.discard(self)
        await self.stop_upstream()

    async def _back(self, request: Any, result_type: Any) -> Any:
        if self.inflight:
            ctx = self.inflight[-1]
            return await ctx.session.send_request(request, result_type, metadata=ServerMessageMetadata(related_request_id=ctx.request_id))
        return await self.connection.send_request(request, result_type=result_type)

    async def on_elicit(self, cctx: ClientRequestContext, params: types.ElicitRequestParams) -> Any:
        try:
            return await self._back(types.ElicitRequest(params=params), types.ElicitResult)
        except MCPError as exc:
            return exc.error

    async def on_sample(self, cctx: ClientRequestContext, params: types.CreateMessageRequestParams) -> Any:
        result_type = types.CreateMessageResultWithTools if params.tools or params.tool_choice else types.CreateMessageResult
        try:
            return await self._back(types.CreateMessageRequest(params=params), result_type)
        except MCPError as exc:
            return exc.error

    async def on_roots(self, cctx: ClientRequestContext) -> Any:
        try:
            return await self._back(types.ListRootsRequest(), types.ListRootsResult)
        except MCPError as exc:
            return exc.error

    async def on_log(self, params: types.LoggingMessageNotificationParams) -> None:
        notification = types.LoggingMessageNotification(params=params)
        if self.inflight:
            ctx = self.inflight[-1]
            await ctx.session.send_notification(notification, related_request_id=ctx.request_id)
        else:
            await self.connection.notify(notification.method, _wire(params))

    async def on_message(self, message: Any) -> None:
        match message:
            case types.ToolListChangedNotification() | types.PromptListChangedNotification() | types.ResourceListChangedNotification():
                upstream = self.upstream
                if upstream is not None and upstream.session is not None and upstream.initialized is not None:
                    await self._settle(upstream)
            case types.ResourceUpdatedNotification(params=params):
                await self.connection.send_resource_updated(params.uri)
            case types.ElicitCompleteNotification(params=params):
                await self.connection.notify(message.method, _wire(params))
            case Exception():
                logger.debug(f"{self.served.spec.name}: upstream transport error: {message!r}")


class _Proxy(Server):
    def __init__(self, served: "_Served"):
        initialize = types.InitializeResult.model_validate(served.catalog["initialize"])
        info = initialize.server_info
        super().__init__(
            info.name,
            version=info.version,
            title=info.title,
            description=info.description,
            instructions=initialize.instructions,
            website_url=info.website_url,
            icons=info.icons,
        )
        self.served = served
        self.capabilities = initialize.capabilities
        for key, method in _LISTS.items():
            self.add_request_handler(method, types.PaginatedRequestParams, self._listed(key))
        for method, params_type in _FORWARDED.items():
            self.add_request_handler(method, params_type, self._forward)
        self.add_request_handler(_LOG_LEVEL, types.SetLevelRequestParams, self._set_level)
        self.add_notification_handler("notifications/roots/list_changed", types.NotificationParams, self._roots_changed)

    def get_capabilities(self, *args: Any, **kwargs: Any) -> types.ServerCapabilities:
        return self.capabilities

    def _listed(self, key: str) -> Callable:
        async def handler(ctx: ServerRequestContext, params: Any) -> dict[str, Any]:
            return {key: self.served.catalog.get(key) or []}

        return handler

    def _link(self, ctx: ServerRequestContext) -> _Link:
        connection = ctx.session._connection
        link = connection.state.get("link")
        if link is None:
            link = connection.state["link"] = _Link(self.served, connection)
            _links.add(link)
            connection.exit_stack.push_async_callback(link.close)
        return link

    async def _forward(self, ctx: ServerRequestContext, params: Any) -> dict[str, Any]:
        link = self._link(ctx)
        raw = dict(ctx.params or {})
        meta = dict(raw.get("_meta") or {})
        token = meta.pop("progressToken", None)
        if meta:
            raw["_meta"] = meta
        else:
            raw.pop("_meta", None)

        async def relay(progress: float, total: Optional[float], message: Optional[str]) -> None:
            await ctx.session.report_progress(progress, total, message)

        link.inflight.append(ctx)
        try:
            upstream = await link.ensure()
            return await upstream.request(ctx.method, raw or None, relay if token is not None else None)
        finally:
            link.inflight.remove(ctx)
            link.used_at = time.monotonic()

    async def _set_level(self, ctx: ServerRequestContext, params: Any) -> dict[str, Any]:
        link = self._link(ctx)
        link.level = (ctx.params or {}).get("level")
        upstream = link.upstream
        if upstream is not None and upstream.session is not None and link.level is not None:
            await upstream.request(_LOG_LEVEL, {"level": link.level})
        return {}

    async def _roots_changed(self, ctx: ServerRequestContext, params: Any) -> None:
        link = ctx.session._connection.state.get("link")
        upstream = link.upstream if link is not None else None
        if upstream is not None and upstream.session is not None:
            await upstream.session.send_roots_list_changed()


class _Served:
    """One server offered to one CLI over HTTP, alive as long as that CLI."""

    def __init__(self, spec: Spec, base: dict[str, str], cwd: str, session_id: Callable[[], Optional[str]]):
        self.spec = spec
        self.base = base
        self.cwd = cwd
        self.session_id = session_id
        self.token = secrets.token_urlsafe(24)
        self.group: Any = None
        self.manager: Optional[StreamableHTTPSessionManager] = None
        self._stop = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

    @property
    def catalog(self) -> dict[str, Any]:
        return _catalogs.get(self.spec.key) or {}

    def env(self) -> dict[str, str]:
        return _spawn_env(self.base, self.spec, self.cwd, self.session_id())

    @property
    def entry(self) -> dict[str, Any]:
        return {"type": "http", "url": f"http://127.0.0.1:{PORT}{PATH}/{self.token}", **self.spec.entry}

    async def start(self) -> None:
        ready = asyncio.Event()
        self._task = asyncio.create_task(self._serve(ready))
        await ready.wait()
        _served[self.token] = self

    async def _serve(self, ready: asyncio.Event) -> None:
        try:
            async with anyio.create_task_group() as group:
                self.group = group
                self.manager = StreamableHTTPSessionManager(
                    app=_Proxy(self), json_response=False, stateless=False, session_idle_timeout=None, max_request_body_size=_MAX_BODY,
                )
                async with self.manager.run():
                    ready.set()
                    await self._stop.wait()
                group.cancel_scope.cancel()
        finally:
            ready.set()

    async def close(self) -> None:
        _served.pop(self.token, None)
        self._stop.set()
        if self._task is not None:
            with anyio.CancelScope(shield=True):
                await self._task


class LazyServers:
    """The servers one CLI gets through the backend, closed with that CLI."""

    def __init__(self, served: list[_Served]):
        self._served = served

    def apply(self, options: Any) -> Any:
        entries = {served.spec.name: served.entry for served in self._served}
        return dataclasses.replace(options, mcp_servers={**entries, **(options.mcp_servers or {})})

    async def close(self) -> None:
        served, self._served = self._served, []
        await asyncio.gather(*(item.close() for item in served), return_exceptions=True)


async def _build(spec: Spec, base: dict[str, str], cwd: str) -> None:
    try:
        async with _BUILDS:
            upstream = _Upstream(spec, _spawn_env(base, spec, cwd, None), cwd)
            async with anyio.create_task_group() as group:
                group.start_soon(upstream.run)
                await upstream.ready.wait()
                try:
                    if upstream.session is not None and upstream.initialized is not None:
                        lists = await _read_lists(upstream.session, upstream.initialized.capabilities)
                        await asyncio.to_thread(_store, spec, {"initialize": _wire(upstream.initialized), **lists})
                finally:
                    await upstream.close()
    except Exception as exc:
        logger.debug(f"MCP catalog of {spec.name} unavailable: {type(exc).__name__}: {exc}")
    finally:
        _building.discard(spec.key)


def _build_later(spec: Spec, base: dict[str, str], cwd: str) -> None:
    if spec.key in _building:
        return
    _building.add(spec.key)
    asyncio.create_task(_build(spec, base, cwd))


async def open_for(options: Any, session_id: Callable[[], Optional[str]]) -> Optional[LazyServers]:
    """Serve the chat's local servers through the backend, those it has a catalog of; the rest start as before and get one."""
    if "user" not in (options.setting_sources or []):
        return None
    cwd = str(options.cwd or "")
    base = {**os.environ, **_SDK_ENV, **(options.env or {})}
    specs = await asyncio.to_thread(_specs, cwd, base)
    await asyncio.to_thread(_load_catalogs, [spec.key for spec in specs])
    served = []
    for spec in specs:
        if spec.key in _catalogs:
            item = _Served(spec, base, cwd, session_id)
            await item.start()
            served.append(item)
        else:
            _build_later(spec, base, cwd)
    return LazyServers(served) if served else None


async def release_idle(still_short: Callable[[], bool]) -> None:
    """Stop the server processes no call is using, least recently used first, while ``still_short`` holds."""
    for link in sorted(_links, key=lambda item: item.used_at):
        if not still_short():
            return
        if link.upstream is not None and not link.inflight:
            await link.stop_upstream()


def _find(token: str) -> Optional[_Served]:
    return next((served for key, served in _served.items() if token and hmac.compare_digest(key, token)), None)


async def _answer(send: Any, status: int, body: bytes = b"") -> None:
    headers = [(b"content-type", b"application/json")] if body else []
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": body})


def _handshake_era(scope: dict) -> bool:
    """The real server is spoken to over stdio in the handshake era, so the CLI gets that same era here."""
    version = next((value.decode("latin-1") for name, value in scope.get("headers") or [] if name == _VERSION_HEADER), None)
    return version is None or version in HANDSHAKE_PROTOCOL_VERSIONS


async def asgi(scope: dict, receive: Any, send: Any) -> None:
    path = scope.get("path") or ""
    root = scope.get("root_path") or ""
    token = (path[len(root):] if root and path.startswith(root) else path).strip("/").split("/", 1)[0]
    served = _find(token) if scope.get("type") == "http" else None
    if served is None or served.manager is None:
        await _answer(send, 404)
        return
    if not _handshake_era(scope):
        await _answer(send, 400, _UNSUPPORTED_VERSION)
        return
    await served.manager.handle_request({**scope, "path": "/", "raw_path": b"/"}, receive, send)
