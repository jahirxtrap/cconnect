"""The Agent Client Protocol agents this server runs: the catalog, installing them, signing them in and their sessions."""

import asyncio
import os
from typing import Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from core.access import key_matches
from core.responses import FILE_HEADERS, api_response
from services import agent_registry, agent_sessions, agents, terminal
from services.acp_peer import AcpError
from services.agent_connections import pool

router = APIRouter(tags=["Agents"])

ICON_HOST = urlparse(agent_registry.REGISTRY_URL).netloc
SVG = "image/svg+xml"


class CustomAgent(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    protocol: Literal[agents.ACP, agents.COMMAND] = agents.ACP
    purpose: str = Field("", max_length=400)
    program: str = Field(min_length=1, max_length=4096)
    args: list[str] = []
    edit_args: list[str] = []
    bypass_args: list[str] = []
    env: dict[str, str] = {}


class AgentChanges(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    protocol: Optional[Literal[agents.ACP, agents.COMMAND]] = None
    purpose: Optional[str] = Field(None, max_length=400)
    program: Optional[str] = Field(None, min_length=1, max_length=4096)
    args: Optional[list[str]] = None
    edit_args: Optional[list[str]] = None
    bypass_args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None
    enabled: Optional[bool] = None


class TerminalLogin(BaseModel):
    method: str = Field(min_length=1, max_length=256)
    cwd: str


def _failed(exc: Exception) -> Response:
    if isinstance(exc, agents.AgentError):
        return api_response(status=422, data={"reason": exc.reason, "detail": exc.detail})
    return api_response(status=502, data={"reason": agents.INSTALL_FAILED, "detail": str(exc)})


def _listed(agent: dict) -> dict:
    shown = {key: value for key, value in agent.items() if key not in ("env", "user_env")}
    return {**shown, "env": sorted(agent["user_env"]), "icon": agents.icon_file(agent["id"]) is not None}


def _offered(item: dict, installed: dict[str, dict]) -> dict:
    kind, _spec, needs = agent_registry.runnable(item)
    return {
        "id": item["id"],
        "name": item.get("name") or item["id"],
        "description": item.get("description") or "",
        "version": item["version"],
        "icon": item.get("icon"),
        "website": item.get("website") or item.get("repository"),
        "authors": item.get("authors") or [],
        "license": item.get("license"),
        "runnable": kind,
        "needs": needs,
        "installed": (installed.get(item["id"]) or {}).get("version"),
    }


@router.get("/agents")
def list_agents():
    return api_response(data={
        "agents": [_listed(agent) for agent in agents.load()],
        "node": agent_registry.node_tools() is not None,
    })


@router.get("/agents/catalog")
async def catalog():
    try:
        items = await asyncio.to_thread(agent_registry.catalog)
    except agent_registry.RegistryError as exc:
        return api_response(status=502, data={"reason": agents.REGISTRY_FAILED, "detail": str(exc)})
    installed = {agent["id"]: agent for agent in agents.load() if agent["source"] == agents.REGISTRY}
    return api_response(data={"agents": [_offered(item, installed) for item in items]})


@router.get("/agents/catalog/icon")
async def catalog_icon(url: str):
    if urlparse(url).netloc != ICON_HOST:
        raise HTTPException(status_code=404, detail="not found")
    data = await asyncio.to_thread(agent_registry.icon, {"icon": url})
    if data is None:
        raise HTTPException(status_code=404, detail="not found")
    return Response(content=data, media_type=SVG, headers=FILE_HEADERS)


@router.get("/agents/{agent_id}/icon")
def agent_icon(agent_id: str):
    found = agents.icon_file(agent_id)
    if found is None:
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(found, media_type=SVG, headers=FILE_HEADERS)


@router.post("/agents/{agent_id}/install")
async def install_agent(agent_id: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    await pool.restart(agent_id)
    try:
        installed = await asyncio.to_thread(agents.install, agent_id)
    except (agents.AgentError, OSError) as exc:
        return _failed(exc)
    return api_response(data=_listed(installed))


@router.post("/agents")
def add_agent(body: CustomAgent, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    fields = body.model_dump(exclude={"env"})
    return api_response(data=_listed(agents.add({
        **fields,
        "name": body.name.strip(),
        "purpose": body.purpose.strip(),
        "program": body.program.strip(),
        "user_env": body.env,
    })))


@router.patch("/agents/{agent_id}")
async def change_agent(agent_id: str, body: AgentChanges, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    changes = body.model_dump(exclude_none=True)
    if "env" in changes:
        changes["user_env"] = changes.pop("env")
    updated = agents.update(agent_id, changes)
    if updated is None:
        raise HTTPException(status_code=404, detail="not found")
    await pool.restart(agent_id)
    return api_response(data=_listed(updated))


@router.delete("/agents/{agent_id}")
async def remove_agent(agent_id: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    await pool.restart(agent_id)
    if agents.remove(agent_id) is None:
        raise HTTPException(status_code=404, detail="not found")
    return api_response()


@router.get("/agents/{agent_id}/env")
def agent_env(agent_id: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    found = agents.find(agent_id)
    if found is None:
        raise HTTPException(status_code=404, detail="not found")
    return api_response(data={"env": found["user_env"]})


@router.get("/agents/{agent_id}/log")
def agent_log(agent_id: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    return api_response(data={"lines": pool.log(agent_id)})


@router.get("/agents/{agent_id}/sessions")
async def agent_sessions_list(agent_id: str, cwd: str, cursor: Optional[str] = None):
    try:
        listed = await agent_sessions.sessions(agent_id, cwd, cursor)
    except (AcpError, agents.AgentError, OSError) as exc:
        return _failed(exc)
    return api_response(data=listed)


@router.delete("/agents/{agent_id}/sessions")
async def agent_session_delete(agent_id: str, cwd: str, session: str):
    try:
        await agent_sessions.forget(agent_id, cwd, session)
    except (AcpError, agents.AgentError, OSError) as exc:
        return _failed(exc)
    return api_response()


async def _signed_in(agent_id: str, held: terminal.Terminal) -> None:
    await held.exited.wait()
    if held.exit_status in (None, 0):
        await pool.restart(agent_id)


async def _login_command(agent_id: str, method: str, cwd: str) -> tuple[str, list[str], dict[str, str]]:
    connection = await pool.take(agent_id, cwd)
    try:
        login = connection.terminal_login(method)
    finally:
        pool.give(connection)
    if login is None:
        raise HTTPException(status_code=404, detail="not found")
    return connection.agent["name"], *login


@router.get("/agents/{agent_id}/login")
async def terminal_login_preview(agent_id: str, method: str, cwd: str, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    try:
        _name, argv, env = await _login_command(agent_id, method, cwd)
    except (AcpError, agents.AgentError, OSError) as exc:
        return _failed(exc)
    return api_response(data={"command": argv, "env": {key: value for key, value in env.items() if os.environ.get(key) != value}})


@router.post("/agents/{agent_id}/login")
async def terminal_login(agent_id: str, body: TerminalLogin, x_security_key: str = Header("")):
    if not key_matches(x_security_key):
        return api_response(status=403)
    try:
        name, argv, env = await _login_command(agent_id, body.method, body.cwd)
    except (AcpError, agents.AgentError, OSError) as exc:
        return _failed(exc)
    try:
        held = terminal.spawn([body.cwd], name, argv=argv, env=env)
    except (OSError, ValueError) as exc:
        return _failed(exc)
    asyncio.get_running_loop().create_task(_signed_in(agent_id, held))
    return api_response(data=terminal.listed(held))
