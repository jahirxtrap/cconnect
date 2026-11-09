from __future__ import annotations

import asyncio
from contextlib import suppress
from pathlib import Path
from typing import Any, Callable, Optional

from loguru import logger
from watchfiles import awatch

from core import cli_manager
from core.config import DEFAULT_CWD
from services import accounts, claude_assets, cli_settings

_LOGIN_TIMEOUT = 600.0
_EXCHANGE_TIMEOUT = 120.0
_ACCOUNT = "account"
_MCP = "mcp"


def _options(env: dict[str, str], cwd: Optional[str] = None, servers: Optional[dict] = None):
    from claude_agent_sdk import ClaudeAgentOptions

    return ClaudeAgentOptions(
        cwd=cwd if cwd and Path(cwd).is_dir() else DEFAULT_CWD,
        cli_path=cli_manager.resolve_cli_path(),
        setting_sources=[],
        strict_mcp_config=True,
        mcp_servers=servers or {},
        env=env,
    )


def _mcp_options(account_id: str, server: str, cwd: Optional[str]):
    config = claude_assets.mcp_config(server, cwd)
    if config is None:
        return None
    return _options({**cli_settings.env(), **accounts.env_for(account_id)}, cwd, {server: config})


async def _ask(client: Any, request: dict, timeout: float = 60.0) -> dict:
    return await client._query._send_control_request(request, timeout) or {}


class _Login:
    def __init__(self, key: tuple, on_end: Optional[Callable[[], None]] = None) -> None:
        self.key = key
        self.client: Any = None
        self.before = ""
        self.ended = asyncio.Event()
        self._stop = asyncio.Event()
        self._owner: Optional[asyncio.Task] = None
        self._on_end = on_end

    async def open(self, options: Any) -> None:
        ready: asyncio.Future = asyncio.get_running_loop().create_future()
        self._owner = asyncio.create_task(self._own(options, ready))
        await ready

    async def _own(self, options: Any, ready: asyncio.Future) -> None:
        from claude_agent_sdk import ClaudeSDKClient

        try:
            async with ClaudeSDKClient(options=options) as client:
                self.client = client
                ready.set_result(None)
                with suppress(asyncio.TimeoutError):
                    await asyncio.wait_for(self._stop.wait(), _LOGIN_TIMEOUT)
        except BaseException as exc:
            if not ready.done():
                ready.set_exception(exc)
            elif not isinstance(exc, asyncio.CancelledError):
                logger.warning(f"sign-in ended: {type(exc).__name__}: {exc}")
        finally:
            self.client = None
            if _logins.get(self.key) is self:
                del _logins[self.key]
            if self._on_end is not None:
                with suppress(OSError):
                    self._on_end()
            self.ended.set()

    async def ask(self, request: dict, timeout: float = 60.0) -> dict:
        if self.client is None:
            raise RuntimeError("the sign-in already ended")
        return await _ask(self.client, request, timeout)

    def close(self) -> None:
        self._stop.set()


_logins: dict[tuple, _Login] = {}


async def _begin(
    key: tuple, options: Any, request: dict, on_end: Optional[Callable[[], None]] = None
) -> tuple[_Login, dict]:
    _cancel(key)
    login = _Login(key, on_end)
    _logins[key] = login
    try:
        await login.open(options)
        return login, await login.ask(request)
    except BaseException:
        _end(login)
        raise


def _cancel(key: tuple) -> None:
    login = _logins.get(key)
    if login is not None:
        _end(login)


def _end(login: _Login) -> None:
    if _logins.get(login.key) is login:
        del _logins[login.key]
    login.close()


def _account_key(account_id: str) -> tuple:
    return (_ACCOUNT, account_id)


def _mcp_key(account_id: str, server: str) -> tuple:
    return (_MCP, account_id, server)


async def start_account(account_id: str) -> dict:
    options = _options(accounts.identity_env(account_id))
    try:
        login, answer = await _begin(_account_key(account_id), options, {"subtype": "claude_authenticate", "loginWithClaudeAi": True})
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    url = answer.get("manualUrl")
    if not url:
        _end(login)
        return {"ok": False, "message": "the CLI did not return an authorization URL"}
    return {"ok": True, "url": url}


async def submit_account_code(account_id: str, code: str) -> dict:
    login = _logins.get(_account_key(account_id))
    if login is None:
        return {"ok": False, "message": "no sign-in in progress"}
    authorization, _, state = code.strip().partition("#")
    try:
        await login.ask(
            {"subtype": "claude_oauth_callback", "authorizationCode": authorization, "state": state},
            _EXCHANGE_TIMEOUT,
        )
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    finally:
        _end(login)
    return {"ok": True}


def cancel_account(account_id: str) -> None:
    _cancel(_account_key(account_id))


async def start_mcp(account_id: str, server: str, cwd: Optional[str]) -> dict:
    options = _mcp_options(account_id, server, cwd)
    if options is None:
        return {"ok": False, "message": f"Server not found: {server}"}
    saved = accounts.mcp_entries(account_id, server)
    try:
        login, answer = await _begin(
            _mcp_key(account_id, server),
            options,
            {"subtype": "mcp_authenticate", "serverName": server},
            lambda: accounts.restore_mcp_entries(account_id, server, saved),
        )
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    url = answer.get("authUrl") if answer.get("requiresUserAction") else None
    if not url:
        _end(login)
        return {"ok": True, "url": None}
    login.before = accounts.mcp_tokens(account_id).get(server, "")
    return {"ok": True, "url": url}


def _renewed(login: _Login, account_id: str, server: str) -> bool:
    token = accounts.mcp_tokens(account_id).get(server, "")
    return bool(token) and token != login.before


async def wait_mcp(account_id: str, server: str) -> bool:
    login = _logins.get(_mcp_key(account_id, server))
    if login is None:
        return False
    credentials = accounts.credentials_path(account_id)
    if not _renewed(login, account_id, server):
        async for _ in awatch(
            credentials.parent,
            watch_filter=lambda _change, path: Path(path).name == credentials.name,
            stop_event=login.ended,
            recursive=False,
        ):
            if _renewed(login, account_id, server):
                break
    done = _renewed(login, account_id, server)
    if done:
        _end(login)
    return done


async def submit_mcp_callback(account_id: str, server: str, url: str) -> dict:
    login = _logins.get(_mcp_key(account_id, server))
    if login is None:
        return {"ok": False, "message": "no sign-in in progress"}
    try:
        await login.ask({"subtype": "mcp_oauth_callback_url", "serverName": server, "callbackUrl": url.strip()}, _EXCHANGE_TIMEOUT)
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    _end(login)
    return {"ok": True}


async def cancel_mcp(account_id: str, server: str) -> None:
    login = _logins.get(_mcp_key(account_id, server))
    if login is None:
        return
    _end(login)
    await login.ended.wait()


async def sign_out_mcp(account_id: str, server: str, cwd: Optional[str]) -> dict:
    from claude_agent_sdk import ClaudeSDKClient

    await cancel_mcp(account_id, server)
    options = _mcp_options(account_id, server, cwd)
    if options is None:
        return {"ok": False, "message": f"Server not found: {server}"}
    try:
        async with ClaudeSDKClient(options=options) as client:
            await _ask(client, {"subtype": "mcp_clear_auth", "serverName": server})
    except Exception as exc:
        return {"ok": False, "message": str(exc)}
    return {"ok": True}
