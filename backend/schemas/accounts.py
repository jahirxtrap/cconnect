"""Request models for the accounts router."""

from pydantic import BaseModel, Field


class AccountCreateRequest(BaseModel):
    label: str


class AccountRenameRequest(BaseModel):
    label: str


class LoginCodeRequest(BaseModel):
    code: str


class ProviderAuth(BaseModel):
    kind: str = "none"
    token: str = ""
    user: str = ""
    password: str = ""
    header_name: str = ""
    header_value: str = ""


class ProviderProbeRequest(BaseModel):
    base_url: str = ""
    auth: ProviderAuth = Field(default_factory=ProviderAuth)


class ProviderUpdateRequest(BaseModel):
    base_url: str
    model: str = ""
    auth: ProviderAuth = Field(default_factory=ProviderAuth)
    context_scope: str = ""


class ProviderAccountRequest(ProviderUpdateRequest):
    label: str
