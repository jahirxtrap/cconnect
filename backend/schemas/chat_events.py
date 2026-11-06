"""Outbound WebSocket events of the chat channel, the contract the app's types are generated from."""

from typing import Annotated, Any, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, WithJsonSchema

Unknown = Annotated[Any, WithJsonSchema({"tsType": "unknown"})]


class Shape(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Event(Shape):
    seq: Optional[int] = None
    channel: Optional[str] = None
    parent: Optional[str] = None
    replay: Optional[bool] = None


class QueuedItem(Shape):
    id: Optional[str] = None
    text: str = ""
    attachments: list[str] = []
    ts: Optional[int] = None
    cli_uuid: Optional[str] = None
    taken: Optional[bool] = None
    withdrawn: Optional[bool] = None


class DiffLine(Shape):
    kind: str
    text: str


class SharedFile(Shape):
    name: str
    url: str


class TodoItem(Shape):
    content: str
    status: str
    active_form: Optional[str] = None


class LimitWindow(Shape):
    id: str
    percent: float
    resets_at: Unknown = None
    severity: Optional[str] = None


class StatusLine(Shape):
    plugin: str
    text: Optional[str] = None


class InteractionOption(Shape):
    id: str
    label: Optional[str] = None
    description: Optional[str] = None
    preview: Optional[str] = None
    kind: Optional[str] = None


class AgentAccount(Shape):
    provider: bool


class Ready(Event):
    type: Literal["ready"]
    session_id: Optional[str] = None
    project: Optional[str] = None
    cwd: Optional[str] = None
    account: Optional[str] = None
    running: bool
    activity: Optional[str] = None
    resident: bool
    resumed: bool
    committed_count: Optional[int] = None
    queued: list[QueuedItem]
    agent: Optional[str] = None


class PermissionMode(Event):
    type: Literal["permission_mode"]
    mode: str


class Rejected(Event):
    type: Literal["rejected"]
    request: Optional[str] = None
    message: str


class Activity(Event):
    type: Literal["activity"]
    state: str
    resident: bool


class AgentState(Event):
    type: Literal["agent_state"]
    agent: Optional[str] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    detail: Optional[str] = None
    session_id: Optional[str] = None
    title: Optional[str] = None
    options: Optional[list[dict]] = None
    commands: Optional[list[dict]] = None
    usage: Optional[dict] = None
    methods: Optional[list[dict]] = None
    signing_in: Unknown = None
    login_url: Optional[str] = None
    prompt: Unknown = None
    sessions: Optional[dict] = None
    logout: Optional[bool] = None
    info: Optional[dict] = None


class History(Event):
    type: Literal["history"]
    items: list[dict]
    start_index: int = 0
    has_more: bool = False


class Stop(Event):
    type: Literal["stop"]
    reason: Optional[str] = None
    severity: Optional[str] = None


class TerminalOpened(Event):
    type: Literal["terminal_opened"]
    id: str
    title: Optional[str] = None
    cwd: Optional[str] = None
    shell: Optional[str] = None
    pty: Unknown = None
    cols: Optional[int] = None
    rows: Optional[int] = None
    alive: Optional[bool] = None
    busy: Optional[bool] = None
    exit_status: Optional[int] = None
    created_at: Optional[float] = None


class AssistantText(Event):
    type: Literal["assistant_text"]
    text: str


class Thinking(Event):
    type: Literal["thinking"]
    text: Optional[str] = None
    label: Optional[bool] = None


class Working(Event):
    type: Literal["working"]


class ToolUse(Event):
    type: Literal["tool_use"]
    id: Optional[str] = None
    name: Optional[str] = None
    mcp: Optional[bool] = None
    input: Optional[str] = None
    result: Optional[str] = None
    ms: Optional[int] = None


class ToolResult(Event):
    type: Literal["tool_result"]
    tool_use_id: Optional[str] = None
    content: Optional[str] = None
    ms: Optional[int] = None


class FileChange(Event):
    type: Literal["file_change"]
    id: Optional[str] = None
    name: Optional[str] = None
    path: str
    diff_lines: list[DiffLine] = []
    label: Optional[bool] = None


class Shared(Event):
    type: Literal["shared"]
    id: Optional[str] = None
    files: list[SharedFile]


class Compacting(Event):
    type: Literal["compacting"]


class CompactingEnded(Event):
    type: Literal["compacting_ended"]


class Status(Event):
    type: Literal["status"]
    kind: str
    attempt: Optional[int] = None
    max_retries: Optional[int] = None
    retry_delay_ms: Optional[float] = None
    error_status: Optional[int] = None
    error: Optional[str] = None
    no_response: Unknown = None


class Compact(Event):
    type: Literal["compact"]
    trigger: Optional[str] = None
    pre_tokens: Optional[int] = None
    post_tokens: Optional[int] = None
    summary: Optional[str] = None


class CompactSummary(Event):
    type: Literal["compact_summary"]
    trigger: Optional[str] = None
    pre_tokens: Optional[int] = None
    post_tokens: Optional[int] = None
    summary: Optional[str] = None


class AskText(Event):
    type: Literal["ask_text"]
    text: str


class AskWorking(Event):
    type: Literal["ask_working"]


class AskSession(Event):
    type: Literal["ask_session"]
    session_id: str


class Command(Event):
    type: Literal["command"]
    markdown: str
    local: Optional[bool] = None


class Usage(Event):
    type: Literal["usage"]
    plan: Optional[str] = None
    windows: Optional[list[dict]] = None
    error: Optional[str] = None
    reason: Optional[str] = None
    local: Optional[bool] = None


class Component(Event):
    type: Literal["component"]
    block_id: Optional[str] = None
    title: Optional[str] = None
    title_key: Optional[str] = None
    icon: Optional[str] = None
    blocks: list[dict]
    local: Optional[bool] = None


class Reloaded(Event):
    type: Literal["reloaded"]
    command: str
    resident: bool
    failed: Optional[bool] = None
    plugins: Optional[int] = None
    commands: Optional[int] = None
    agents: Optional[int] = None
    mcp_servers: Optional[int] = None
    errors: Optional[int] = None
    held: Optional[bool] = None


class Agent(Event):
    type: Literal["agent"]
    id: Optional[str] = None
    subagent_type: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    effort: Optional[str] = None
    agent: Optional[str] = None
    account: Optional[AgentAccount] = None


class TaskRunning(Event):
    type: Literal["task_running"]
    id: Optional[str] = None
    task: Optional[str] = None
    description: Optional[str] = None


class AgentResult(Event):
    type: Literal["agent_result"]
    id: Optional[str] = None
    status: Optional[str] = None
    duration_ms: Optional[int] = None
    tokens: Optional[int] = None
    tool_uses: Optional[int] = None


class ThinkingTokens(Event):
    type: Literal["thinking_tokens"]
    tokens: int


class HookFailed(Event):
    type: Literal["hook_failed"]
    name: Optional[str] = None
    event: Optional[str] = None
    text: str


class Notification(Event):
    type: Literal["notification"]
    text: str
    result: Optional[str] = None


class Notice(Event):
    type: Literal["notice"]
    name: Optional[str] = None
    text: str
    level: Optional[str] = None
    uuid: Optional[str] = None


class Mods(Event):
    type: Literal["mods"]
    surface: bool
    panes: list[dict]
    shown_id: Optional[str] = None
    focused_id: Optional[str] = None
    focus_requested_id: Optional[str] = None
    status: list[StatusLine]
    commands: list[dict]


class Commands(Event):
    type: Literal["commands"]
    commands: list[dict]


class ModToast(Event):
    type: Literal["mod_toast"]
    plugin: Optional[str] = None
    text: str
    timeout_ms: Optional[int] = None


class ModInvalidate(Event):
    type: Literal["mod_invalidate"]
    instances: Optional[list[dict]] = None


class ModTree(Event):
    type: Literal["mod_tree"]
    rid: Optional[int] = None
    component: Optional[str] = None
    instance_id: Optional[str] = None
    tree: Optional[dict] = None
    props: Optional[dict] = None
    hooked: Optional[bool] = None
    client_modules: Optional[dict] = None


class ModReply(Event):
    type: Literal["mod_reply"]
    rid: int
    answer: Unknown = None


class ModRequest(Event):
    type: Literal["mod_request"]
    id: str
    kind: str
    text: Optional[str] = None
    mode: Optional[str] = None
    plugin: Optional[str] = None


class ModFocus(Event):
    type: Literal["mod_focus"]
    component: Optional[str] = None
    instance_id: Optional[str] = None
    plugin: Optional[str] = None
    key: Optional[str] = None


class ModScroll(Event):
    type: Literal["mod_scroll"]
    component: Optional[str] = None
    instance_id: Optional[str] = None
    offset: int = 0
    follow_end: Optional[bool] = None


class SessionMessage(Event):
    type: Literal["session_message"]
    name: Optional[str] = None
    text: str


class PluginMessage(Event):
    type: Literal["plugin_message"]
    name: Optional[str] = None
    text: str


class AgentReport(Event):
    type: Literal["agent_report"]
    name: Optional[str] = None
    text: str


class Todos(Event):
    type: Literal["todos"]
    items: list[TodoItem]


class Task(Event):
    type: Literal["task"]
    id: str
    content: Optional[str] = None
    status: Optional[str] = None


class SessionStarted(Event):
    type: Literal["session_started"]
    session_id: Optional[str] = None


class Result(Event):
    type: Literal["result"]
    session_id: Optional[str] = None
    cost_usd: Optional[float] = None
    is_error: Optional[bool] = None


class Context(Event):
    type: Literal["context"]
    context_tokens: Optional[int] = None
    context_window: Optional[int] = None
    request_bytes: Optional[int] = None
    media_bytes: Optional[int] = None


class RateLimit(Event):
    type: Literal["rate_limit"]
    windows: list[LimitWindow]


class Cache(Event):
    type: Literal["cache"]
    cache: Optional[dict] = None


class Anchor(Event):
    type: Literal["anchor"]
    uuid: str


class Done(Event):
    type: Literal["done"]


class Interrupted(Event):
    type: Literal["interrupted"]


class Attached(Event):
    type: Literal["attached"]


class Error(Event):
    type: Literal["error"]
    message: str


class ApiError(Event):
    type: Literal["api_error"]
    text: str
    severity: Optional[str] = None


class Queued(Event):
    type: Literal["queued"]
    id: Optional[str] = None
    text: str
    ts: Optional[int] = None


class Queue(Event):
    type: Literal["queue"]
    items: list[QueuedItem]


class Dequeued(Event):
    type: Literal["dequeued"]
    ids: list[Optional[str]]
    text: Optional[str] = None
    consumed: int = 0
    ts: Optional[int] = None


class HistoryChunk(Event):
    type: Literal["history_chunk"]
    session_id: str
    items: list[dict]
    start_index: int
    has_more: bool


class Tail(Event):
    type: Literal["tail"]
    items: list[dict]


class InteractionRequest(Event):
    type: Literal["interaction_request"]
    id: str
    kind: str
    tool_name: Optional[str] = None
    tool_kind: Optional[str] = None
    tool_use_id: Optional[str] = None
    input: Optional[str] = None
    options: list[InteractionOption] = []
    free_text: Unknown = None
    title: Optional[str] = None
    title_key: Optional[str] = None
    icon: Optional[str] = None
    blocks: list[dict] = []
    submit: Optional[str] = None
    submit_key: Optional[str] = None
    dismiss: Optional[dict] = None
    present: Optional[str] = None
    variant: Optional[str] = None
    mod: Optional[dict] = None
    block_id: Optional[str] = None


class InteractionResolved(Event):
    type: Literal["interaction_resolved"]
    id: str
    option_id: Optional[str] = None
    values: Unknown = None
    dismissed: Optional[bool] = None


class Pong(Event):
    type: Literal["pong"]


ChatEvent = Annotated[
    Union[
        Ready, PermissionMode, Rejected, Activity, AgentState, History, Stop, TerminalOpened,
        AssistantText, Thinking, Working, ToolUse, ToolResult, FileChange, Shared, Compacting, CompactingEnded,
        Status, Compact, CompactSummary, AskText, AskWorking, AskSession, Command, Usage, Component, Reloaded,
        Agent, TaskRunning, AgentResult, ThinkingTokens, HookFailed, Notification, Notice, Mods, Commands,
        ModToast, ModInvalidate, ModTree, ModReply, ModRequest, ModFocus, ModScroll, SessionMessage,
        PluginMessage, AgentReport, Todos, Task, SessionStarted, Result, Context, RateLimit, Cache, Anchor,
        Done, Interrupted, Attached, Error, ApiError, Queued, Queue, Dequeued, HistoryChunk, Tail,
        InteractionRequest, InteractionResolved, Pong,
    ],
    Field(discriminator="type"),
]

CHAT_EVENT = TypeAdapter(ChatEvent)
