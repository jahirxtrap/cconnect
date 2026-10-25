"""Inbound WebSocket message models for the chat channel."""

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


class VisibilityPrefs(BaseModel):
    simple: Optional[bool] = None
    tokens: Optional[bool] = None
    timings: Optional[bool] = None
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
    channel: Optional[str] = None
    last_seq: int = 0
    capabilities: list[str] = []
    security_key: Optional[str] = None


class PromptMessage(BaseModel):
    type: Literal["prompt"]
    text: str
    attachments: list[str] = []
    id: Optional[str] = None
    channel: Optional[str] = None


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


ModComponent = Literal[
    "Pane",
    "AbovePrompt",
    "SessionMode",
    "PromptHint",
    "Spinner",
    "UserMessage",
    "AssistantMessage",
    "ToolUse",
    "ToolResult",
    "ToolGroup",
    "CommandOutput",
    "AskUserQuestion",
]


class ModRenderMessage(BaseModel):
    type: Literal["mod_render"]
    component: ModComponent
    instance_id: str = Field(max_length=256)
    props: dict = Field(default_factory=dict)
    columns: int = Field(80, ge=10, le=500)
    rows: int = Field(24, ge=1, le=200)
    offset: int = Field(0, ge=0)
    rid: int = 0


class ModClientModuleMessage(BaseModel):
    type: Literal["mod_client_module"]
    plugin: str = Field(max_length=256)
    rid: int = 0


class ModClientEvent(BaseModel):
    type: Literal["press", "input", "select"]
    kind: Optional[Literal["change", "submit"]] = None
    value: Optional[str] = Field(None, max_length=16384)


class ModElement(BaseModel):
    plugin: str
    key: str


class ModKeyed(ModElement):
    top: int = Field(ge=0)
    bottom: int = Field(ge=0)


class ModStroke(BaseModel):
    key: str = Field(min_length=1, max_length=32)
    ctrl: Optional[Literal[True]] = None
    shift: Optional[Literal[True]] = None
    meta: Optional[Literal[True]] = None


class ModActionMessage(BaseModel):
    type: Literal["mod_act"]
    action: Literal[
        "press",
        "input",
        "select",
        "close",
        "show",
        "focus",
        "site_focus",
        "site_scroll",
        "client_press",
        "client_message",
        "client_fault",
        "prompt_edit",
        "prompt_autocomplete",
    ]
    rid: Optional[int] = None
    plugin: Optional[str] = None
    handle: Optional[Union[int, str]] = None
    key: Optional[str] = None
    href: Optional[str] = Field(None, max_length=2048)
    kind: Optional[Literal["change", "submit"]] = None
    value: Optional[str] = None
    id: Optional[str] = None
    component: Optional[ModComponent] = None
    instance_id: Optional[str] = None
    client: Optional[str] = Field(None, max_length=256)
    module: Optional[str] = Field(None, max_length=256)
    event: Optional[ModClientEvent] = None
    data: Optional[Any] = None
    phase: Optional[Literal["load", "render", "run"]] = None
    reason: Optional[str] = Field(None, max_length=200)
    is_held: Optional[bool] = None
    element: Optional[Union[ModElement, str]] = None
    by: Optional[Union[int, Literal["person", "auto", "app"]]] = None
    offset: Optional[int] = Field(None, ge=0)
    body_rows: Optional[int] = Field(None, ge=0)
    content_rows: Optional[int] = Field(None, ge=0)
    keyed: Optional[list[ModKeyed]] = None
    text: Optional[str] = Field(None, max_length=1_000_000)
    cursor: Optional[int] = Field(None, ge=0)
    stroke: Optional[ModStroke] = None


class ModAnswerMessage(BaseModel):
    type: Literal["mod_answer"]
    id: str
    answer: dict = Field(default_factory=dict)
