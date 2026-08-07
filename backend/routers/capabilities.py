"""Expose runtime capabilities (models, permission modes, effort levels) to the app."""

from fastapi import APIRouter

from core import cli_manager
from core.config import (
    SERVER_VERSION,
    COLORS,
    COMMANDS,
    DEFAULT_EFFORT,
    DEFAULT_MODEL,
    DEFAULT_PERMISSION_MODE,
    MODELS,
    PERMISSION_LABELS,
    SUPPORTED_APP,
    SUPPORTED_CLI,
    ULTRACODE_EFFORT,
    effort_levels,
    permission_modes,
)
from core.responses import api_response
from services import accounts

router = APIRouter(tags=["Capabilities"])


@router.get("/capabilities")
def get_capabilities():
    account_list = accounts.list_accounts()
    return api_response(data={
        "version": SERVER_VERSION,
        "supported_app": SUPPORTED_APP,
        "cli_version": cli_manager.active_version(),
        "supported_cli": SUPPORTED_CLI,
        "permission_modes": [{"id": m, "label": PERMISSION_LABELS.get(m, m)} for m in permission_modes()],
        "effort_levels": ["default"] + list(effort_levels()) + [ULTRACODE_EFFORT],
        "models": MODELS,
        "colors": COLORS,
        "commands": COMMANDS,
        "accounts": [{"id": a["id"], "label": a["label"]} for a in account_list if a["logged_in"]],
        "defaults": {
            "permission_mode": DEFAULT_PERMISSION_MODE,
            "effort": DEFAULT_EFFORT,
            "model": DEFAULT_MODEL,
            "account": accounts.default_account({a["id"] for a in account_list}),
            "partial": False,
        },
    })
