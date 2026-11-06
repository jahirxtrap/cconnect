"""Health endpoint — liveness plus SDK status and the version contract.
"""

from fastapi import APIRouter, Request

from core import access, cli_manager, config
from core.config import SERVER_VERSION, SHARED_SCHEME, SUPPORTED_APP, SUPPORTED_CLI
from core.responses import api_response
from core.sdk import sdk_status
from middleware.public_auth import http_bearer_ok

router = APIRouter(tags=["Health"])


@router.get("/health")
def health(request: Request):
    return api_response(data={
        "sdk": sdk_status(),
        "version": SERVER_VERSION,
        "supported_app": SUPPORTED_APP,
        "cli_version": cli_manager.active_version(),
        "supported_cli": SUPPORTED_CLI,
        "shared_scheme": SHARED_SCHEME,
        "exposure": {
            "gated": access.gated(),
            "authorized": http_bearer_ok(request),
            "public_url": config.PUBLIC_URL or None,
        },
    })
