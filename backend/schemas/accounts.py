"""Request models for the accounts router."""

from pydantic import BaseModel


class AccountCreateRequest(BaseModel):
    label: str


class AccountRenameRequest(BaseModel):
    label: str


class LoginCodeRequest(BaseModel):
    code: str


class ProviderAccountRequest(BaseModel):
    label: str
    base_url: str
    model: str = ""
    token: str = ""
