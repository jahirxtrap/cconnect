"""Claude accounts: list, create, rename, delete and remote OAuth login."""

from fastapi import APIRouter

from core.responses import api_response
from schemas.accounts import AccountCreateRequest, AccountRenameRequest, LoginCodeRequest
from services import account_login, accounts

router = APIRouter(tags=["accounts"])


@router.get("/accounts")
def get_accounts():
    return api_response(data={"accounts": accounts.list_accounts(), "default": accounts.default_account()})


@router.post("/accounts")
def create_account(payload: AccountCreateRequest):
    if not payload.label.strip():
        return api_response(status=400)
    return api_response(data=accounts.create(payload.label))


@router.put("/accounts/{account_id}")
def rename_account(account_id: str, payload: AccountRenameRequest):
    if not accounts.rename(account_id, payload.label):
        return api_response(status=404)
    return api_response()


@router.delete("/accounts/{account_id}")
def delete_account(account_id: str):
    if not accounts.delete(account_id):
        return api_response(status=404)
    return api_response()


@router.post("/accounts/{account_id}/mcp-sync")
def sync_account_mcp(account_id: str):
    accounts.sync_mcp_servers(account_id)
    return api_response()


@router.post("/accounts/{account_id}/login")
def start_login(account_id: str):
    if accounts.config_dir(account_id) is None:
        return api_response(status=404)
    result = account_login.start(account_id)
    if not result["ok"]:
        return api_response(status=500, message=result.get("message"))
    return api_response(data={"url": result["url"]})


@router.post("/accounts/{account_id}/login/code")
def submit_login_code(account_id: str, payload: LoginCodeRequest):
    result = account_login.submit_code(account_id, payload.code)
    if not result["ok"]:
        return api_response(status=400, message=result.get("message"))
    return api_response()


@router.delete("/accounts/{account_id}/login")
def cancel_login(account_id: str):
    account_login.cancel(account_id)
    return api_response()
