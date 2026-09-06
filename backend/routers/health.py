"""Health endpoint — liveness plus SDK status and the version contract.
"""

from fastapi import APIRouter

from core import cli_manager, config
from core.config import SERVER_VERSION, SUPPORTED_APP, SUPPORTED_CLI
from core.responses import api_response
from core.sdk import sdk_status
from services import terminal

router = APIRouter(tags=["Health"])


@router.get("/health")
def health():
    return api_response(data={
        "sdk": sdk_status(),
        "version": SERVER_VERSION,
        "supported_app": SUPPORTED_APP,
        "cli_version": cli_manager.active_version(),
        "supported_cli": SUPPORTED_CLI,
        "exposure": {
            "gated": terminal.gated(),
            "public_url": config.PUBLIC_URL or None,
        },
    })
