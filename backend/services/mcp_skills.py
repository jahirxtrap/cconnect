"""The skills MCP servers serve through the io.modelcontextprotocol/skills extension."""

import asyncio
import base64
import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Optional

import anyio
from loguru import logger
from mcp.client.client import Client
from mcp.client.sse import sse_client
from mcp.client.streamable_http import create_mcp_http_client, streamable_http_client

from services import accounts, claude_assets, mcp_lazy

_REMOTE_TYPES = ("http", "sse")
_SOURCES = ("user", "local", "plugin")
_TIMEOUT = 10.0
_SKILL_FILE = "SKILL.md"
_DYNAMIC = "dynamic"

_remote: dict[str, Optional[list[Any]]] = {}


def _servers(cwd: str) -> list[claude_assets.DeclaredMcp]:
    return [server for server in claude_assets.declared_mcp(cwd) if server.source in _SOURCES and server.enabled and not server.muted]


def _token(name: str) -> str:
    known = sorted(accounts.known_ids(), key=lambda account: account != accounts.PRIMARY_ID)
    return next((token for account in known if (token := accounts.mcp_tokens(account).get(name))), "")


def _remote_of(server: claude_assets.DeclaredMcp) -> Optional[tuple[str, dict[str, str]]]:
    cfg = server.config
    url = cfg.get("url")
    headers = {str(key): str(value) for key, value in (cfg.get("headers") or {}).items()}
    if claude_assets.mcp_kind(cfg) not in _REMOTE_TYPES or not isinstance(url, str) or claude_assets.PLACEHOLDER_MARK in json.dumps([url, headers]):
        return None
    token = _token(server.name)
    return url, {**headers, **({"Authorization": f"Bearer {token}"} if token else {})}


@asynccontextmanager
async def _connected(kind: str, url: str, headers: dict[str, str]) -> AsyncIterator[Client]:
    transport = (
        sse_client(url, headers=headers, timeout=_TIMEOUT)
        if kind == "sse"
        else streamable_http_client(url, http_client=create_mcp_http_client(headers=headers))
    )
    with anyio.fail_after(_TIMEOUT):
        async with Client(transport, mode="auto", read_timeout_seconds=_TIMEOUT) as client:
            yield client


async def _remote_skills(server: claude_assets.DeclaredMcp, refresh: bool) -> Optional[list[Any]]:
    target = _remote_of(server)
    if target is None:
        return None
    url, headers = target
    key = json.dumps([server.name, url, headers], sort_keys=True)
    if refresh or key not in _remote:
        try:
            async with _connected(claude_assets.mcp_kind(server.config), url, headers) as client:
                _remote[key] = await mcp_lazy.skills_listed(client)
        except Exception as exc:
            logger.debug(f"skills of {server.name} unavailable: {type(exc).__name__}: {exc}")
            return None
    return _remote[key]


def _root(uri: str) -> str:
    return uri.rsplit("/", 1)[0] + "/"


def _entry(server: claude_assets.DeclaredMcp, skill: Any) -> Optional[dict]:
    if not isinstance(skill, dict) or not isinstance(skill.get("uri"), str):
        return None
    frontmatter = skill.get("frontmatter") if isinstance(skill.get("frontmatter"), dict) else {}
    uri = skill["uri"]
    root = _root(uri)
    resources = skill.get("resources")
    files = (
        [item["uri"][len(root):] for item in resources if isinstance(item, dict) and str(item.get("uri", "")).startswith(root)]
        if isinstance(resources, list)
        else None
    )
    return {
        "name": str(frontmatter.get("name") or uri.removeprefix(root).removesuffix(_SKILL_FILE).strip("/") or uri),
        "id": uri,
        "description": frontmatter.get("description"),
        "plugin": None,
        "plugin_name": server.label,
        "enabled": True,
        "server": server.name,
        "root": root,
        "files": files,
    }


async def _skills_by_server(cwd: str, refresh: bool) -> list[tuple[claude_assets.DeclaredMcp, list[Any]]]:
    servers = await asyncio.to_thread(_servers, cwd)
    local = await mcp_lazy.local_skills(cwd)
    remote = await asyncio.gather(*(_remote_skills(server, refresh) for server in servers))
    return [
        (server, local.get(server.name) or found or [])
        for server, found in zip(servers, remote)
        if local.get(server.name) or found
    ]


async def listed(cwd: str, refresh: bool = False) -> list[dict]:
    return [entry for server, skills in await _skills_by_server(cwd, refresh) for skill in skills if (entry := _entry(server, skill))]


def _serves(skills: list[Any], uri: str) -> bool:
    for skill in skills:
        entry = skill if isinstance(skill, dict) else {}
        main = entry.get("uri")
        if not isinstance(main, str) or not uri.startswith(_root(main)):
            continue
        resources = entry.get("resources")
        listed_files = resources if isinstance(resources, list) else []
        if uri == main or resources == _DYNAMIC or any(isinstance(item, dict) and item.get("uri") == uri for item in listed_files):
            return True
    return False


def _text(result: Any) -> str:
    parts = []
    for content in result.contents:
        text = getattr(content, "text", None)
        parts.append(text if isinstance(text, str) else base64.b64decode(getattr(content, "blob", "") or "").decode("utf-8", "replace"))
    return "\n".join(parts)


async def read(server_name: str, uri: str, cwd: str) -> Optional[str]:
    """A skill file's text, read from the server that lists it; None for a file it does not serve."""
    found = next(((server, skills) for server, skills in await _skills_by_server(cwd, False) if server.name == server_name), None)
    if found is None or not _serves(found[1], uri):
        return None
    server = found[0]
    target = _remote_of(server)
    try:
        if target is None:
            result = await mcp_lazy.read_local(server.name, uri, cwd)
        else:
            async with _connected(claude_assets.mcp_kind(server.config), *target) as client:
                result = await client.read_resource(uri)
    except Exception as exc:
        logger.debug(f"{uri} on {server_name} unreadable: {type(exc).__name__}: {exc}")
        return None
    return _text(result) if result is not None else None
