"""Inbound WebSocket message models for the chat channel."""

from typing import Literal, Optional

from pydantic import BaseModel


class VisibilityPrefs(BaseModel):
    simple: Optional[bool] = None
    thinking: Optional[str] = None
    tool_use: Optional[str] = None
    file_change: Optional[str] = None
    compact: Optional[str] = None
    working: Optional[str] = None


class SetVisibilityMessage(VisibilityPrefs):
    type: Literal["set_visibility"]


class StartMessage(BaseModel):
    type: Literal["start"]
    visibility: Optional[VisibilityPrefs] = None
    cwd: str
    permission_mode: Optional[str] = None
    resume: Optional[str] = None
    fork: bool = False
    model: Optional[str] = None
    account: Optional[str] = None
    effort: Optional[str] = None
    partial: Optional[bool] = None
    base_url: Optional[str] = None
    channel: Optional[str] = None
    last_seq: int = 0
    capabilities: list[str] = []
    terminal_key: Optional[str] = None


class PromptMessage(BaseModel):
    type: Literal["prompt"]
    text: str
    attachments: list[str] = []
    id: Optional[str] = None


class SetGenerationMessage(BaseModel):
    type: Literal["set_generation"]
    cwd: Optional[str] = None
    model: Optional[str] = None
    effort: Optional[str] = None
    partial: Optional[bool] = None
    account: Optional[str] = None


class SetPermissionMessage(BaseModel):
    type: Literal["set_permission_mode"]
    mode: str


class InterruptMessage(BaseModel):
    type: Literal["interrupt"]
