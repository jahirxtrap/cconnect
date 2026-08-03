"""Claude Code management: user prompt, plugins, marketplaces, skills, MCP and memories."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from core.responses import api_response
from services import claude_assets, claude_manage
from services import claude_status
from services import usage as usage_service

router = APIRouter(tags=["Claude"])


@router.get("/claude/usage")
async def get_usage(account: str | None = None):
    return api_response(data=await usage_service.usage_data(account))


@router.get("/claude/status")
async def get_status():
    return api_response(data=await claude_status.service_status())


class PromptBody(BaseModel):
    text: str


class PluginActionBody(BaseModel):
    action: str  # install | uninstall | enable | disable | update
    plugin: str  # name@marketplace


class MarketplaceActionBody(BaseModel):
    action: str  # add | remove | update
    target: str  # source for add, name otherwise


class McpAddBody(BaseModel):
    name: str
    target: str  # command line (stdio) or url (http/sse)
    transport: str = "stdio"


class McpToggleBody(BaseModel):
    name: str
    enabled: bool


@router.get("/claude/prompt")
def get_user_prompt():
    return api_response(data={"text": claude_assets.get_user_prompt()})


@router.put("/claude/prompt")
def set_user_prompt(body: PromptBody):
    claude_assets.set_user_prompt(body.text)
    return api_response()


class ProjectPromptBody(BaseModel):
    project: str
    text: str


@router.get("/claude/project-prompt")
def get_project_prompt(project: str = ""):
    return api_response(data={"text": claude_assets.get_project_prompt(project)})


@router.put("/claude/project-prompt")
def set_project_prompt(body: ProjectPromptBody):
    claude_assets.set_project_prompt(body.project, body.text)
    return api_response()


@router.get("/claude/plugins")
def get_plugins():
    return api_response(data={
        "plugins": claude_assets.list_plugins(),
        "marketplaces": claude_assets.list_marketplaces(),
    })


@router.post("/claude/plugins/action")
def plugin_action(body: PluginActionBody):
    return api_response(data=claude_manage.plugin_action(body.action, body.plugin))


@router.post("/claude/marketplaces/action")
def marketplace_action(body: MarketplaceActionBody):
    return api_response(data=claude_manage.marketplace_action(body.action, body.target))


@router.get("/claude/marketplaces/{name}/catalog")
def marketplace_catalog(name: str):
    try:
        return api_response(data=claude_assets.marketplace_catalog(name))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/claude/skills")
def get_skills():
    return api_response(data=claude_assets.list_skills())


@router.get("/claude/skills/files")
def get_skill_files(skill: str, plugin: str | None = None):
    try:
        files = claude_assets.list_skill_files(plugin, skill)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response(data={"files": files})


@router.get("/claude/skills/file")
def get_skill_file(skill: str, plugin: str | None = None, file: str = "SKILL.md"):
    try:
        text = claude_assets.read_skill(plugin, skill, file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if text is None:
        raise HTTPException(status_code=404, detail="skill not found")
    return Response(content=text, media_type="text/markdown; charset=utf-8")


@router.get("/claude/mcp")
def get_mcp():
    return api_response(data=claude_assets.list_mcp_servers())


@router.post("/claude/mcp")
def add_mcp(body: McpAddBody):
    return api_response(data=claude_manage.mcp_add(body.name, body.target, body.transport))


@router.post("/claude/mcp/toggle")
def toggle_mcp(body: McpToggleBody):
    return api_response(data=claude_manage.mcp_set_enabled(body.name, body.enabled))


@router.delete("/claude/mcp/{name}")
def remove_mcp(name: str):
    return api_response(data=claude_manage.mcp_remove(name))


@router.get("/claude/memories")
def get_memories(project: str | None = None):
    return api_response(data=claude_assets.list_memories(project))


@router.get("/claude/memories/file")
def get_memory_file(scope: str, name: str, project: str = ""):
    try:
        text = claude_assets.read_memory(scope, project, name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if text is None:
        raise HTTPException(status_code=404, detail="memory not found")
    return Response(content=text, media_type="text/markdown; charset=utf-8")


@router.delete("/claude/memories")
def delete_memory(scope: str, name: str, project: str = ""):
    try:
        deleted = claude_assets.delete_memory(scope, project, name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail="memory not found")
    return api_response()
