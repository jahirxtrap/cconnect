"""Bearer-token gate for the public surface. No-op when PUBLIC_ACCESS_TOKEN is unset."""

import hmac

from fastapi import FastAPI, Request, WebSocket
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import PUBLIC_ACCESS_TOKEN
from core.responses import api_response

# Open so the mobile app can probe connectivity before it has a token.
_OPEN_PATHS = frozenset({"/api/health"})


def _provided_token(authorization: str, query_token: str) -> str:
    """The query form is what iframes and media elements can carry: they send no headers."""
    scheme, _, value = (authorization or "").partition(" ")
    if scheme.lower() == "bearer":
        return value.strip()
    return query_token or ""


def ws_bearer_ok(ws: WebSocket) -> bool:
    if PUBLIC_ACCESS_TOKEN is None:
        return True
    token = _provided_token(ws.headers.get("authorization", ""), ws.query_params.get("token", ""))
    return hmac.compare_digest(token, PUBLIC_ACCESS_TOKEN)


class PublicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if PUBLIC_ACCESS_TOKEN is None:
            return await call_next(request)
        if request.url.path in _OPEN_PATHS:
            return await call_next(request)

        provided = _provided_token(
            request.headers.get("authorization", ""),
            request.query_params.get("token", ""),
        )
        if not provided or not hmac.compare_digest(provided, PUBLIC_ACCESS_TOKEN):
            return api_response(status=401)

        return await call_next(request)


def register_public_auth_middleware(app: FastAPI):
    app.add_middleware(PublicAuthMiddleware)
