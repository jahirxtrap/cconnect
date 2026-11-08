"""Claude accounts: list, create, rename, delegation, delete and remote OAuth login."""

import asyncio

from fastapi import APIRouter, Request, Response

from core.responses import api_response
from schemas.accounts import (
    AccountCreateRequest,
    AccountDelegationRequest,
    AccountRenameRequest,
    LoginCodeRequest,
    ProviderAccountRequest,
    ProviderProbeRequest,
    ProviderUpdateRequest,
)
from services import accounts, cli_info, cli_login, live_sessions, providers

router = APIRouter(tags=["accounts"])


@router.get("/accounts")
def get_accounts():
    items = accounts.list_accounts()
    known = {item["id"] for item in items}
    return api_response(data={
        "accounts": items,
        "default": accounts.default_account(known),
        "provider_url": providers.DEFAULT_BASE_URL,
        "provider_presets": providers.PRESETS,
        "provider_scopes": providers.SCOPE_IDS,
        "provider_scope_default": providers.DEFAULT_SCOPE,
    })


@router.post("/accounts")
def create_account(payload: AccountCreateRequest):
    if not payload.label.strip():
        return api_response(status=400)
    return api_response(data=accounts.create(payload.label))


@router.post("/accounts/provider/probe")
async def detect_provider(payload: ProviderProbeRequest):
    headers = accounts.auth_headers(payload.auth.model_dump())
    return api_response(data=await providers.detect(payload.base_url, headers))


@router.post("/accounts/provider")
async def create_provider_account(payload: ProviderAccountRequest):
    auth = payload.auth.model_dump()
    model = payload.model.strip()
    if not model and providers.pins_model(payload.base_url):
        found = await providers.models(payload.base_url, accounts.auth_headers(auth))
        model = found[0]["id"] if found else ""
    account = accounts.create_provider(payload.label, payload.base_url, model, auth, payload.context_scope)
    if account is None:
        return api_response(status=400)
    cli_info.invalidate()
    return api_response(data=account)


@router.get("/accounts/{account_id}/provider")
def get_provider_account(account_id: str):
    provider = accounts.provider_for(account_id)
    if not provider:
        return api_response(status=404)
    return api_response(data={
        "base_url": provider["base_url"],
        "model": provider.get("model", ""),
        "auth": provider.get("auth") or {},
        "context_scope": providers.scope_for(provider.get("context_scope"))["id"],
    })


@router.put("/accounts/{account_id}/provider")
async def update_provider_account(account_id: str, payload: ProviderUpdateRequest):
    auth = payload.auth.model_dump()
    stored = accounts.provider_for(account_id)
    kept = stored.get("model", "") if stored.get("base_url") == payload.base_url.strip().rstrip("/") else ""
    model = (kept if payload.model is None else payload.model).strip()
    if not model and providers.pins_model(payload.base_url):
        found = await providers.models(payload.base_url, accounts.auth_headers(auth))
        model = found[0]["id"] if found else ""
    if not accounts.update_provider(account_id, payload.base_url, model, auth, payload.context_scope):
        return api_response(status=404)
    cli_info.invalidate()
    return api_response()


@router.put("/accounts/{account_id}")
def rename_account(account_id: str, payload: AccountRenameRequest):
    if not accounts.rename(account_id, payload.label):
        return api_response(status=404)
    return api_response()


@router.put("/accounts/{account_id}/delegation")
def set_account_delegation(account_id: str, payload: AccountDelegationRequest):
    if not accounts.set_delegation(account_id, payload.delegate, payload.purpose):
        return api_response(status=404)
    return api_response()


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    holders = live_sessions.registry.on_account(account_id)
    if not accounts.forget(account_id):
        return api_response(status=404)
    cli_login.cancel_account(account_id)
    cli_info.invalidate()
    _pending_purges.add(asyncio.create_task(_purge(account_id, holders)))
    return api_response()


_PURGE_ATTEMPTS = 10
_PURGE_PAUSE = 1.0
_pending_purges: set[asyncio.Task] = set()


async def _purge(account_id: str, holders: list) -> None:
    try:
        await live_sessions.registry.release_all(holders)
        for _ in range(_PURGE_ATTEMPTS):
            if await asyncio.to_thread(accounts.purge, account_id):
                return
            await asyncio.sleep(_PURGE_PAUSE)
    finally:
        _pending_purges.discard(asyncio.current_task())


@router.post("/accounts/import")
async def import_account(request: Request, label: str = ""):
    account = accounts.import_bundle(await request.body(), label)
    if account is None:
        return api_response(status=400)
    cli_info.invalidate()
    return api_response(data=account)


@router.get("/accounts/{account_id}/export")
def export_account(account_id: str):
    data = accounts.export_bundle(account_id)
    if data is None:
        return api_response(status=404)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{account_id}.zip"'},
    )


@router.post("/accounts/{account_id}/login")
async def start_login(account_id: str):
    if account_id not in accounts.known_ids():
        return api_response(status=404)
    result = await cli_login.start_account(account_id)
    if not result["ok"]:
        return api_response(status=500, message=result.get("message"))
    return api_response(data={"url": result["url"]})


@router.post("/accounts/{account_id}/login/code")
async def submit_login_code(account_id: str, payload: LoginCodeRequest):
    result = await cli_login.submit_account_code(account_id, payload.code)
    if not result["ok"]:
        return api_response(status=400, message=result.get("message"))
    return api_response()


@router.delete("/accounts/{account_id}/login")
async def cancel_login(account_id: str):
    cli_login.cancel_account(account_id)
    return api_response()
