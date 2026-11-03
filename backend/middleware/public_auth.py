"""Bearer-token gate for the public surface. No-op when PUBLIC_ACCESS_TOKEN is unset."""

import hmac

from fastapi import FastAPI, Request, WebSocket
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import PUBLIC_ACCESS_TOKEN
from core.responses import api_response
from services import agent_mcp, pages

# Open so the mobile app can probe connectivity before it has a token.
_OPEN_PATHS = frozenset({"/api/health", "/api/agents/browse"})
_OPEN_PREFIXES = (f"{agent_mcp.PATH}/", f"{pages.PATH}/")


def _provided_token(authorization: str, query_token: str) -> str:
    """The query form is what iframes and media elements can carry: they send no headers."""
    scheme, _, value = (authorization or "").partition(" ")
    if scheme.lower() == "bearer":
        return value.strip()
    return query_token or ""


def _token_ok(authorization: str, query_token: str) -> bool:
    if PUBLIC_ACCESS_TOKEN is None:
        return True
    provided = _provided_token(authorization, query_token)
    return bool(provided) and hmac.compare_digest(provided, PUBLIC_ACCESS_TOKEN)


def ws_bearer_ok(ws: WebSocket) -> bool:
    return _token_ok(ws.headers.get("authorization", ""), ws.query_params.get("token", ""))


def http_bearer_ok(request: Request) -> bool:
    return _token_ok(
        request.headers.get("authorization", ""),
        request.query_params.get("token", ""),
    )


class PublicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if PUBLIC_ACCESS_TOKEN is None:
            return await call_next(request)
        if request.url.path in _OPEN_PATHS or request.url.path.startswith(_OPEN_PREFIXES):
            return await call_next(request)
        if not http_bearer_ok(request):
            return api_response(status=401)

        return await call_next(request)


def register_public_auth_middleware(app: FastAPI):
    app.add_middleware(PublicAuthMiddleware)
