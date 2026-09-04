"""Select and update the Claude Code CLI the backend drives, from the phone."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core import cli_manager
from core.responses import api_response
from core.sdk import sdk_status, update_sdk

router = APIRouter(tags=["CLI"])


class CliSourceBody(BaseModel):
    source: str
    custom_path: Optional[str] = None


class CliUpdateBody(BaseModel):
    source: Optional[str] = None
    custom_path: Optional[str] = None


@router.get("/cli")
def get_cli():
    return api_response(data=cli_manager.status())


@router.post("/cli")
def set_cli(body: CliSourceBody):
    try:
        cli_manager.set_source(body.source, body.custom_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return api_response(data=cli_manager.status())


@router.post("/cli/update")
def update_cli(body: Optional[CliUpdateBody] = None):
    body = body or CliUpdateBody()
    return api_response(data=cli_manager.update_cli(body.source, body.custom_path))


@router.get("/cli/sdk")
def get_sdk():
    return api_response(data=sdk_status())


@router.post("/cli/sdk/update")
async def update_agent_sdk():
    return api_response(data=await update_sdk())
