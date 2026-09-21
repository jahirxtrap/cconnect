"""Backend-owned settings (model, effort, permission, streaming, CLI source), shared by
every client that connects to this backend. The app reads/writes these instead of keeping
them locally; only app-local prefs (theme, language, accent) stay on the device."""

from typing import Any

from fastapi import APIRouter, HTTPException

from core.responses import api_response
from services import cli_settings, persistent_sessions, settings_store

router = APIRouter(tags=["Settings"])


def _all() -> dict[str, dict]:
    return {**settings_store.describe(), **cli_settings.describe()}


@router.get("/settings")
def get_settings():
    return api_response(data=_all())


@router.post("/settings")
async def update_settings(body: dict[str, Any]):
    try:
        for key, value in body.items():
            owner = cli_settings if key in cli_settings.SETTINGS else settings_store
            owner.set(key, value)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not persistent_sessions.enabled():
        await persistent_sessions.pool.close_all()
    return api_response(data=_all())


@router.post("/settings/reset")
async def reset_settings():
    settings_store.reset()
    cli_settings.reset()
    if not persistent_sessions.enabled():
        await persistent_sessions.pool.close_all()
    return api_response(data=_all())
