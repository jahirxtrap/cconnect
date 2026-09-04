"""CConnect — FastAPI application entry point."""

import importlib
import os
import pkgutil

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded

from core.config import PORT, RUNTIME_FILE
from core.db import init_db
from core.rate_limit import limiter
from core.responses import api_response
from core.sdk import ensure_sdk_installed, ensure_subscription_auth
from services import settings_store, system_monitor
from middleware.error_handler import register_error_handlers
from middleware.public_auth import register_public_auth_middleware
from middleware.security import register_security_middleware
import routers as routers_pkg


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    settings_store.load()
    RUNTIME_FILE.write_text(f"PORT={PORT}\nPID={os.getpid()}\n", encoding="utf-8")
    system_monitor.setup_log_capture()
    ensure_subscription_auth()
    await ensure_sdk_installed()
    from services import cli_info
    await cli_info.refresh()
    from services import chat_list
    await chat_list.hub.start()
    from services import shared_watch
    await shared_watch.hub.start()
    from services import network
    await network.watchdog.start()
    yield
    chat_list.hub.stop()
    shared_watch.hub.stop()
    network.watchdog.stop()
    RUNTIME_FILE.unlink(missing_ok=True)


app = FastAPI(
    title="CConnect API",
    version="0.1.0",
    description="Remote bridge between the CConnect mobile app and Claude Code",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return api_response(status=429)


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

app.add_middleware(GZipMiddleware, minimum_size=512)
register_security_middleware(app)
register_public_auth_middleware(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)

for module_info in pkgutil.iter_modules(routers_pkg.__path__):
    module = importlib.import_module(f"routers.{module_info.name}")
    if hasattr(module, "router"):
        app.include_router(module.router, prefix="/api")


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"],
    include_in_schema=False,
)
async def catch_all(request: Request, path: str):
    return api_response(status=404)
