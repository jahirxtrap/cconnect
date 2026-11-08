export type ChatEvent =
  | Ready
  | PermissionMode
  | Rejected
  | Activity
  | AgentState
  | History
  | Stop
  | TerminalOpened
  | AssistantText
  | Thinking
  | Working
  | ToolUse
  | ToolResult
  | FileChange
  | Shared
  | Compacting
  | CompactingEnded
  | Status
  | Compact
  | CompactSummary
  | AskText
  | AskWorking
  | AskSession
  | Command
  | Usage
  | Component
  | Reloaded
  | Agent
  | TaskRunning
  | AgentResult
  | ThinkingTokens
  | HookFailed
  | Notification
  | Notice
  | Mods
  | Commands
  | ModToast
  | ModInvalidate
  | ModTree
  | ModReply
  | ModRequest
  | ModFocus
  | ModScroll
  | SessionMessage
  | PluginMessage
  | AgentReport
  | Todos
  | Task
  | SessionStarted
  | Result
  | Context
  | RateLimit
  | Cache
  | Anchor
  | Done
  | Interrupted
  | Attached
  | Error
  | ApiError
  | Queued
  | Queue
  | Dequeued
  | HistoryChunk
  | Tail
  | InteractionRequest
  | InteractionResolved
  | Pong;

export interface Ready {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "ready";
  session_id?: string | null;
  project?: string | null;
  cwd?: string | null;
  account?: string | null;
  running: boolean;
  activity?: string | null;
  resident: boolean;
  resumed: boolean;
  stale?: boolean;
  committed_count?: number | null;
  queued: QueuedItem[];
  agent?: string | null;
}
export interface QueuedItem {
  id?: string | null;
  text?: string;
  attachments?: string[];
  ts?: number | null;
  cli_uuid?: string | null;
  taken?: boolean | null;
  withdrawn?: boolean | null;
}
export interface PermissionMode {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "permission_mode";
  mode: string;
}
export interface Rejected {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "rejected";
  request?: string | null;
  message: string;
}
export interface Activity {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "activity";
  state: string;
  resident: boolean;
  account?: string | null;
}
export interface AgentState {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "agent_state";
  agent?: string | null;
  status?: string | null;
  reason?: string | null;
  detail?: string | null;
  session_id?: string | null;
  title?: string | null;
  options?:
    | {
        [k: string]: unknown;
      }[]
    | null;
  commands?:
    | {
        [k: string]: unknown;
      }[]
    | null;
  usage?: {
    [k: string]: unknown;
  } | null;
  methods?:
    | {
        [k: string]: unknown;
      }[]
    | null;
  signing_in?: unknown;
  login_url?: string | null;
  prompt?: unknown;
  sessions?: {
    [k: string]: unknown;
  } | null;
  logout?: boolean | null;
  info?: {
    [k: string]: unknown;
  } | null;
}
export interface History {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "history";
  items: {
    [k: string]: unknown;
  }[];
  start_index?: number;
  has_more?: boolean;
}
export interface Stop {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "stop";
  reason?: string | null;
  severity?: string | null;
}
export interface TerminalOpened {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "terminal_opened";
  id: string;
  title?: string | null;
  cwd?: string | null;
  shell?: string | null;
  pty?: unknown;
  cols?: number | null;
  rows?: number | null;
  alive?: boolean | null;
  busy?: boolean | null;
  exit_status?: number | null;
  created_at?: number | null;
}
export interface AssistantText {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "assistant_text";
  text: string;
}
export interface Thinking {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "thinking";
  text?: string | null;
  label?: boolean | null;
}
export interface Working {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "working";
}
export interface ToolUse {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "tool_use";
  id?: string | null;
  name?: string | null;
  mcp?: boolean | null;
  input?: string | null;
  result?: string | null;
  ms?: number | null;
  query?: QueryCall | null;
  statements?: QueryStatement[] | null;
}
export interface QueryCall {
  connection: string;
  name: string;
  database?: string | null;
  sql: string;
  writes: boolean;
  saved: boolean;
}
export interface QueryStatement {
  kind: "rows" | "changed" | "structure" | "done";
  columns?: string[] | null;
  rows?: (string | null)[][] | null;
  affected?: number | null;
  more?: boolean;
  structure?: QueryColumn[] | null;
  effect?: QueryEffect | null;
}
export interface QueryColumn {
  name: string;
  type: string;
  primary_key: boolean;
  nullable: boolean;
  auto: boolean;
  default?: string | null;
}
export interface QueryEffect {
  action: "inserted" | "updated" | "deleted" | "created" | "altered" | "dropped";
  object: string;
  schema?: string | null;
  name: string;
}
export interface ToolResult {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "tool_result";
  tool_use_id?: string | null;
  content?: string | null;
  ms?: number | null;
  statements?: QueryStatement[] | null;
}
export interface FileChange {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "file_change";
  id?: string | null;
  name?: string | null;
  path: string;
  diff_lines?: DiffLine[];
  label?: boolean | null;
}
export interface DiffLine {
  kind: string;
  text: string;
}
export interface Shared {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "shared";
  id?: string | null;
  files: SharedFile[];
}
export interface SharedFile {
  name: string;
  url: string;
}
export interface Compacting {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "compacting";
}
export interface CompactingEnded {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "compacting_ended";
}
export interface Status {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "status";
  kind: string;
  attempt?: number | null;
  max_retries?: number | null;
  retry_delay_ms?: number | null;
  error_status?: number | null;
  error?: string | null;
  no_response?: unknown;
}
export interface Compact {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "compact";
  earlier?: string | null;
  trigger?: string | null;
  pre_tokens?: number | null;
  post_tokens?: number | null;
  summary?: string | null;
}
export interface CompactSummary {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "compact_summary";
  earlier?: string | null;
  trigger?: string | null;
  pre_tokens?: number | null;
  post_tokens?: number | null;
  summary?: string | null;
}
export interface AskText {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "ask_text";
  text: string;
}
export interface AskWorking {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "ask_working";
}
export interface AskSession {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "ask_session";
  session_id: string;
}
export interface Command {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "command";
  markdown: string;
  local?: boolean | null;
}
export interface Usage {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "usage";
  plan?: string | null;
  windows?:
    | {
        [k: string]: unknown;
      }[]
    | null;
  error?: string | null;
  reason?: string | null;
  local?: boolean | null;
}
export interface Component {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "component";
  block_id?: string | null;
  title?: string | null;
  title_key?: string | null;
  icon?: string | null;
  blocks: {
    [k: string]: unknown;
  }[];
  local?: boolean | null;
}
export interface Reloaded {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "reloaded";
  command: string;
  resident: boolean;
  failed?: boolean | null;
  plugins?: number | null;
  commands?: number | null;
  agents?: number | null;
  mcp_servers?: number | null;
  errors?: number | null;
  held?: boolean | null;
}
export interface Agent {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "agent";
  id?: string | null;
  subagent_type?: string | null;
  description?: string | null;
  model?: string | null;
  effort?: string | null;
  agent?: string | null;
  account?: AgentAccount | null;
}
export interface AgentAccount {
  provider: boolean;
}
export interface TaskRunning {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "task_running";
  id?: string | null;
  task?: string | null;
  description?: string | null;
}
export interface AgentResult {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "agent_result";
  id?: string | null;
  status?: string | null;
  duration_ms?: number | null;
  tokens?: number | null;
  tool_uses?: number | null;
}
export interface ThinkingTokens {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "thinking_tokens";
  tokens: number;
}
export interface HookFailed {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "hook_failed";
  name?: string | null;
  event?: string | null;
  text: string;
}
export interface Notification {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "notification";
  text: string;
  result?: string | null;
}
export interface Notice {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "notice";
  name?: string | null;
  text: string;
  level?: string | null;
  uuid?: string | null;
}
export interface Mods {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mods";
  surface: boolean;
  panes: {
    [k: string]: unknown;
  }[];
  shown_id?: string | null;
  focused_id?: string | null;
  focus_requested_id?: string | null;
  status: StatusLine[];
  commands: {
    [k: string]: unknown;
  }[];
}
export interface StatusLine {
  plugin: string;
  text?: string | null;
}
export interface Commands {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "commands";
  commands: {
    [k: string]: unknown;
  }[];
}
export interface ModToast {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_toast";
  plugin?: string | null;
  text: string;
  timeout_ms?: number | null;
}
export interface ModInvalidate {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_invalidate";
  instances?:
    | {
        [k: string]: unknown;
      }[]
    | null;
}
export interface ModTree {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_tree";
  rid?: number | null;
  component?: string | null;
  instance_id?: string | null;
  tree?: {
    [k: string]: unknown;
  } | null;
  props?: {
    [k: string]: unknown;
  } | null;
  hooked?: boolean | null;
  client_modules?: {
    [k: string]: unknown;
  } | null;
}
export interface ModReply {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_reply";
  rid: number;
  answer?: unknown;
}
export interface ModRequest {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_request";
  id: string;
  kind: string;
  text?: string | null;
  mode?: string | null;
  plugin?: string | null;
}
export interface ModFocus {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_focus";
  component?: string | null;
  instance_id?: string | null;
  plugin?: string | null;
  key?: string | null;
}
export interface ModScroll {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "mod_scroll";
  component?: string | null;
  instance_id?: string | null;
  offset?: number;
  follow_end?: boolean | null;
}
export interface SessionMessage {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "session_message";
  name?: string | null;
  text: string;
}
export interface PluginMessage {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "plugin_message";
  name?: string | null;
  text: string;
}
export interface AgentReport {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "agent_report";
  name?: string | null;
  text: string;
}
export interface Todos {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "todos";
  items: TodoItem[];
}
export interface TodoItem {
  content: string;
  status: string;
  active_form?: string | null;
}
export interface Task {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "task";
  id: string;
  content?: string | null;
  status?: string | null;
}
export interface SessionStarted {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "session_started";
  session_id?: string | null;
}
export interface Result {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "result";
  session_id?: string | null;
  cost_usd?: number | null;
  is_error?: boolean | null;
}
export interface Context {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "context";
  context_tokens?: number | null;
  context_window?: number | null;
  request_bytes?: number | null;
  media_bytes?: number | null;
}
export interface RateLimit {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "rate_limit";
  windows: LimitWindow[];
}
export interface LimitWindow {
  id: string;
  percent: number;
  resets_at?: unknown;
  severity?: string | null;
}
export interface Cache {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "cache";
  cache?: {
    [k: string]: unknown;
  } | null;
}
export interface Anchor {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "anchor";
  uuid: string;
}
export interface Done {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "done";
}
export interface Interrupted {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "interrupted";
}
export interface Attached {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "attached";
}
export interface Error {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "error";
  message: string;
}
export interface ApiError {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "api_error";
  text: string;
  severity?: string | null;
}
export interface Queued {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "queued";
  id?: string | null;
  text: string;
  ts?: number | null;
}
export interface Queue {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "queue";
  items: QueuedItem[];
}
export interface Dequeued {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "dequeued";
  ids: (string | null)[];
  text?: string | null;
  consumed?: number;
  ts?: number | null;
}
export interface HistoryChunk {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "history_chunk";
  session_id: string;
  items: {
    [k: string]: unknown;
  }[];
  start_index: number;
  has_more: boolean;
  earlier?: string | null;
}
export interface Tail {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "tail";
  items: {
    [k: string]: unknown;
  }[];
}
export interface InteractionRequest {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "interaction_request";
  id: string;
  kind: string;
  tool_name?: string | null;
  tool_kind?: string | null;
  tool_use_id?: string | null;
  input?: string | null;
  options?: InteractionOption[];
  free_text?: unknown;
  title?: string | null;
  title_key?: string | null;
  icon?: string | null;
  blocks?: {
    [k: string]: unknown;
  }[];
  submit?: string | null;
  submit_key?: string | null;
  dismiss?: {
    [k: string]: unknown;
  } | null;
  present?: string | null;
  variant?: string | null;
  mod?: {
    [k: string]: unknown;
  } | null;
  block_id?: string | null;
}
export interface InteractionOption {
  id: string;
  label?: string | null;
  description?: string | null;
  preview?: string | null;
  kind?: string | null;
}
export interface InteractionResolved {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "interaction_resolved";
  id: string;
  option_id?: string | null;
  values?: unknown;
  dismissed?: boolean | null;
}
export interface Pong {
  seq?: number | null;
  channel?: string | null;
  parent?: string | null;
  replay?: boolean | null;
  type: "pong";
}
