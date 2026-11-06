"""Security middleware — headers and request size limits."""

from fastapi import FastAPI, HTTPException
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from core.responses import api_response
from services import pages

MAX_BODY_SIZE = 500 * 1_048_576
STREAMED_UPLOAD = ("PUT", "/api/shared/")

FRAMEABLE_PATHS = ("/api/shared/", "/api/shared-archive-file", f"{pages.PATH}/")

_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Server": ".",
}

_UNFRAMED = {
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        added = {**_HEADERS, **({} if scope["path"].startswith(FRAMEABLE_PATHS) else _UNFRAMED)}

        async def stamped(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in added.items():
                    headers[name] = value
            await send(message)

        await self.app(scope, receive, stamped)


class RequestSizeLimitMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        method, prefix = STREAMED_UPLOAD
        if scope["type"] != "http" or (scope["method"] == method and scope["path"].startswith(prefix)):
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared and declared.isdigit() and int(declared) > MAX_BODY_SIZE:
            await api_response(status=413)(scope, receive, send)
            return
        received = 0

        async def counted() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > MAX_BODY_SIZE:
                    raise HTTPException(status_code=413)
            return message

        await self.app(scope, counted, send)


def register_security_middleware(app: FastAPI):
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)
