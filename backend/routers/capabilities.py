"""Expose runtime capabilities (models, permission modes, effort levels) to the app."""

from fastapi import APIRouter, Query

from core import cli_manager
from core.config import (
    SERVER_VERSION,
    COLORS,
    DEFAULT_EFFORT,
    DEFAULT_MODEL,
    DEFAULT_PERMISSION_MODE,
    PERMISSION_LABELS,
    SUPPORTED_APP,
    SUPPORTED_CLI,
    permission_modes,
)
from core.responses import api_response
from services import accounts, cli_info
import mcps

router = APIRouter(tags=["Capabilities"])


@router.get("/capabilities")
async def get_capabilities(capabilities: str = Query(""), account: str = Query("")):
    account_list = accounts.list_accounts()
    client = [item.strip() for item in capabilities.split(",") if item.strip()]
    info = await cli_info.server_info(account=account)
    listed = cli_info.models(info, account)
    default_model = DEFAULT_MODEL
    if listed and not any(model["id"] == DEFAULT_MODEL for model in listed):
        default_model = listed[0]["id"]
    return api_response(data={
        "version": SERVER_VERSION,
        "supported_app": SUPPORTED_APP,
        "cli_version": cli_manager.active_version(),
        "supported_cli": SUPPORTED_CLI,
        "permission_modes": [{"id": m, "label": PERMISSION_LABELS.get(m, m)} for m in permission_modes()],
        "models": listed,
        "output_styles": cli_info.output_styles(info),
        "fast_mode": cli_info.fast_mode(info),
        "colors": COLORS,
        "commands": cli_info.commands(info),
        "accounts": [
            {"id": a["id"], "label": a["label"], "provider": a["provider"] is not None}
            for a in account_list if a["logged_in"]
        ],
        "mcp_tools": mcps.tool_specs(client),
        "defaults": {
            "permission_mode": DEFAULT_PERMISSION_MODE,
            "effort": DEFAULT_EFFORT,
            "model": default_model,
            "account": accounts.default_account({a["id"] for a in account_list}),
            "partial": False,
        },
    })
