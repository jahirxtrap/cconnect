"""Request models for the accounts router."""

from pydantic import BaseModel


class AccountCreateRequest(BaseModel):
    label: str


class AccountRenameRequest(BaseModel):
    label: str


class LoginCodeRequest(BaseModel):
    code: str
