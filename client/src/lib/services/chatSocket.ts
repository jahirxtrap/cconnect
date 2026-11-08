import {
  diffKindOf,
  queryOf,
  sharedFilesFrom,
  statementsOf,
  VALUE_SEPARATOR,
  type AgentRun,
  type CompactData,
  type ComponentCondition,
  type ComponentConfirm,
  type ComponentElement,
  type ComponentOption,
  type ComponentType,
  type DiffLine,
  type InteractionMod,
  type InteractionOption,
  type InteractionRequest,
  type QueryCall,
  type QueryStatement,
  type QueuedMessage,
  type SharedFile,
  type TodoItem,
} from "$lib/data/chatModels";
import { toAgentState, type AgentState } from "$lib/data/agentModels";
import type { ApiRetry } from "$lib/data/apiRetry";
import { CLIENT_CAPABILITIES } from "$lib/data/clientCapabilities";
import type { Reload } from "$lib/data/reload";
import { promptCacheOf, type PromptCache } from "$lib/data/promptCache";
import { usageOf, type LimitWindow, type Usage } from "$lib/data/usageWindows";
import {
  toModComponent,
  toModDrawn,
  toModRequest,
  toModSiteTargets,
  toModState,
  type ModAction,
  type ModActionFields,
  type ModComponent,
  type ModDrawn,
  type ModRenderSite,
  type ModRequest,
  type ModSiteTarget,
  type ModState,
} from "$lib/data/modModels";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { flag, list, number, strings, text, type Wire } from "$lib/data/wire";
import type * as Contract from "$lib/contract/chatEvents";
import { describeSocket, nativeSockets, onSocketTap, openSocket } from "$lib/platform/androidSocket";
import type { TerminalInfo } from "./terminalApi";
import { backend, socketUrlOf, type Profile } from "./backend.svelte";
import { toCommands, type CommandOption, type CommandWire } from "./capabilitiesApi";
import { Redial } from "./socket";
import type { VisibilityPrefs } from "$lib/data/settings.svelte";

export type ServerEvent =
  | { type: "connecting"; resumed?: boolean }
  | { type: "open" }
  | {
      type: "ready";
      sessionId: string | null;
      project: string | null;
      cwd: string | null;
      account: string | null;
      channel: string | null;
      running: boolean;
      resumed: boolean;
      committedCount: number | null;
      queued: QueuedMessage[];
      activity: string | null;
      resident: boolean;
      agent: string | null;
    }
  | { type: "rejected"; request: string | null; message: string }
  | { type: "activity"; state: string | null; resident: boolean; account: string | null }
  | { type: "agent_state"; state: AgentState }
  | { type: "history"; items: Record<string, unknown>[]; startIndex: number; hasMore: boolean }
  | { type: "stop"; reason: string | null; severity: string | null }
  | { type: "terminal_opened"; session: TerminalInfo }
  | { type: "assistant_text"; text: string }
  | { type: "thinking"; text: string; labelOnly: boolean }
  | { type: "working" }
  | {
      type: "tool_use";
      id: string | null;
      name: string | null;
      mcp: boolean;
      input: string | null;
      result: string | null;
      ms: number | null;
      query: QueryCall | null;
      statements: QueryStatement[] | null;
    }
  | {
      type: "tool_result";
      toolUseId: string | null;
      content: string | null;
      ms: number | null;
      statements: QueryStatement[] | null;
    }
  | { type: "file_change"; id: string | null; tool: string | null; path: string; diffLines: DiffLine[]; labelOnly: boolean }
  | { type: "shared"; id: string | null; files: SharedFile[] }
  | { type: "compacting" }
  | { type: "compacting_ended" }
  | { type: "status"; kind: string; retry: ApiRetry | null }
  | ({ type: "compact" } & CompactData)
  | ({ type: "compact_summary" } & CompactData)
  | { type: "ask_text"; text: string }
  | { type: "ask_working" }
  | { type: "ask_session"; sessionId: string }
  | { type: "command"; markdown: string; local: boolean }
  | { type: "usage"; usage: Usage; local: boolean }
  | {
      type: "component";
      title: string | null;
      titleKey: string | null;
      icon: string | null;
      blocks: ComponentElement[];
      local: boolean;
    }
  | ({ type: "reloaded" } & Reload)
  | ({
      type: "agent";
      id: string | null;
      subagentType: string | null;
      description: string | null;
    } & AgentRun)
  | { type: "task_running"; id: string | null; description: string | null }
  | {
      type: "agent_result";
      id: string | null;
      status: string | null;
      durationMs: number | null;
      tokens: number | null;
      toolUses: number | null;
    }
  | { type: "thinking_tokens"; tokens: number }
  | { type: "hook_failed"; name: string | null; text: string }
  | { type: "notification"; summary: string; status: string | null }
  | { type: "notice"; name: string | null; text: string; level: string | null }
  | { type: "mods"; state: ModState }
  | { type: "commands"; commands: CommandOption[] }
  | { type: "mod_toast"; plugin: string | null; text: string; timeoutMs: number | null }
  | { type: "mod_invalidate"; instances: ModSiteTarget[] | null }
  | { type: "mod_tree"; rid: number; component: ModComponent; instanceId: string; drawn: ModDrawn }
  | { type: "mod_reply"; rid: number; answer: unknown }
  | { type: "mod_request"; request: ModRequest }
  | { type: "mod_focus"; component: ModComponent; instanceId: string; plugin: string; key: string }
  | { type: "mod_scroll"; component: ModComponent; instanceId: string; offset: number; followEnd: boolean }
  | { type: "session_message"; name: string | null; text: string }
  | { type: "plugin_message"; name: string | null; text: string }
  | { type: "agent_report"; name: string | null; text: string }
  | { type: "todos"; items: TodoItem[] }
  | { type: "task"; id: string; content: string | null; status: string | null }
  | { type: "session_started"; sessionId: string | null }
  | { type: "result"; sessionId: string | null }
  | {
      type: "context";
      contextTokens: number | null;
      contextWindow: number | null;
      requestBytes: number | null;
      mediaBytes: number | null;
    }
  | { type: "rate_limit"; windows: LimitWindow[] }
  | { type: "cache"; cache: PromptCache | null }
  | { type: "anchor"; uuid: string }
  | { type: "done"; replay: boolean }
  | { type: "interrupted" }
  | { type: "attached" }
  | { type: "error"; message: string }
  | { type: "api_error"; message: string; severity: string | null }
  | { type: "closed"; reason: string }
  | { type: "queued"; id: string | null; text: string; replay: boolean }
  | { type: "queue"; items: QueuedMessage[] }
  | { type: "dequeued"; ids: string[]; text: string | null; ts: number | null }
  | {
      type: "history_chunk";
      sessionId: string;
      startIndex: number;
      items: Record<string, unknown>[];
      hasMore: boolean;
    }
  | { type: "tail"; items: Record<string, unknown>[] }
  | ({
      type: "interaction_request";
      replay: boolean;
      toolName: string | null;
      toolUseId: string | null;
      input: string | null;
    } & InteractionRequest)
  | {
      type: "interaction_resolved";
      requestId: string;
      optionId: string | null;
      values: Record<string, string> | null;
      dismissed: boolean;
    };

export interface StartOptions {
  cwd: string;
  permissionMode: string;
  resume: string | null;
  model: string;
  effort: string;
  partial: boolean;
  account: string;
  visibility: VisibilityPrefs;
  agent: string | null;
  locale: string;
}

export interface GenerationPatch {
  model?: string;
  effort?: string;
  partial?: boolean;
  account?: string;
  cwd?: string;
}

const PING_MS = 20_000;
const STALE_MS = 45_000;

export const diffLinesOf = (raw: Wire): DiffLine[] =>
  list(raw, "diff_lines").map((line) => ({ kind: diffKindOf(text(line, "kind")), text: text(line, "text") ?? "" }));

export const agentRunOf = (raw: Wire): AgentRun => {
  const account = raw.account && typeof raw.account === "object" ? (raw.account as Wire) : null;
  return {
    model: text(raw, "model"),
    effort: text(raw, "effort"),
    agent: text(raw, "agent"),
    account: account ? { provider: flag(account, "provider") } : null,
  };
};

export const agentFieldsOf = (raw: Wire) => ({
  subagentType: text(raw, "subagent_type"),
  description: text(raw, "description"),
  ...agentRunOf(raw),
});

const queuedOf = (items: Contract.QueuedItem[] | undefined): QueuedMessage[] =>
  (items ?? [])
    .map((item) => ({ id: item.id ?? "", text: item.text ?? "", attachments: item.attachments ?? [], uploading: false }))
    .filter((item) => item.id !== "");

const toOption = (option: Contract.InteractionOption): InteractionOption => ({
  id: option.id,
  label: option.label ?? null,
  description: option.description ?? null,
  preview: option.preview ?? null,
});

const toInteractionMod = (raw: unknown): InteractionMod | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  const instanceId = text(wire, "instance_id");
  const drawn = toModDrawn({ ...wire, hooked: true });
  if (!instanceId || !drawn.tree) return null;
  const props = wire.props && typeof wire.props === "object" ? (wire.props as Record<string, unknown>) : {};
  return { instanceId, props, drawn: { ...drawn, props: null } };
};

const toValues = (raw: unknown): Record<string, string> | null => {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? value.map(String).join(VALUE_SEPARATOR) : String(value);
  }
  return out;
};

const COMPONENT_TYPES = [
  "text",
  "select",
  "input",
  "toggle",
  "buttons",
  "preview",
  "page",
  "group",
  "notes",
  "bar",
  "slider",
  "color",
  "path",
  "file",
] as const;

const PREFILLED = new Set<ComponentType>(["input", "path", "file", "color"]);

const toConfirm = (raw: unknown): ComponentConfirm | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  const body = text(wire, "text");
  if (!body) return null;
  return { title: text(wire, "title"), text: body, confirmLabel: text(wire, "confirm_label") };
};

const toCondition = (raw: unknown): ComponentCondition | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  const id = text(wire, "id");
  if (!id) return null;
  return {
    id,
    equals: text(wire, "equals"),
    oneOf: Array.isArray(wire.in) ? strings(wire, "in") : null,
    truthy: typeof wire.truthy === "boolean" ? (wire.truthy as boolean) : null,
  };
};

export const toDismiss = (raw: unknown): ComponentOption | null => {
  if (!raw || typeof raw !== "object") return null;
  const wire = raw as Wire;
  return {
    value: "",
    label: text(wire, "label") ?? "",
    description: null,
    preview: null,
    style: null,
    icon: text(wire, "icon"),
    labelKey: text(wire, "label_key"),
    confirm: toConfirm(wire.confirm),
  };
};

export const toElement = (raw: Wire): ComponentElement[] => {
  const type = text(raw, "type") as ComponentType | null;
  if (!type || !COMPONENT_TYPES.includes(type)) return [];
  const value = raw.value;
  return [
    {
      type,
      id: text(raw, "id"),
      label: text(raw, "label"),
      text: type === "text" || type === "bar" ? text(raw, "text") : null,
      textKey: text(raw, "text_key"),
      placeholder: text(raw, "placeholder"),
      placeholderKey: text(raw, "placeholder_key"),
      value:
        type === "bar"
          ? String(value ?? 0)
          : type === "slider"
            ? (typeof value === "number" || typeof value === "string" ? String(value) : null)
            : PREFILLED.has(type) && typeof value === "string"
              ? value
              : null,
      color: text(raw, "color"),
      alertAbove: number(raw, "alert_above"),
      alertBelow: number(raw, "alert_below"),
      severity: text(raw, "severity"),
      checked: value === true,
      multiline: flag(raw, "multiline"),
      lines: number(raw, "lines"),
      secret: flag(raw, "secret"),
      multiple: flag(raw, "multiple"),
      required: flag(raw, "required"),
      showIf: toCondition(raw.show_if),
      format: text(raw, "format"),
      display: text(raw, "display"),
      min: number(raw, "min"),
      max: number(raw, "max"),
      step: number(raw, "step"),
      minLength: number(raw, "min_length"),
      maxLength: number(raw, "max_length"),
      pattern: text(raw, "pattern"),
      error: text(raw, "error"),
      open: flag(raw, "open"),
      pick: text(raw, "pick"),
      start: text(raw, "start"),
      accept: text(raw, "accept"),
      options: list(raw, "options").map((option) => ({
        value: text(option, "value") ?? "",
        label: text(option, "label") ?? "",
        description: text(option, "description"),
        preview: text(option, "preview"),
        style: text(option, "style"),
        icon: text(option, "icon"),
        labelKey: text(option, "label_key"),
        confirm: toConfirm(option.confirm),
      })),
      block: raw.block && typeof raw.block === "object" ? JSON.stringify(raw.block) : null,
      blocks: list(raw, "blocks").flatMap(toElement),
    },
  ];
};

export class ChatSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #redial = new Redial(() => this.#open(), (stale) => this.#onWake(stale));

  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #lastSeen = 0;
  #channel: string | null = null;
  #lastSeq = 0;
  #sideChannel: string | null = null;
  #sideLastSeq = 0;
  #sideResume: string | null = null;

  #subject = "";

  constructor(
    private readonly onEvent: (side: boolean, parent: string | null, event: ServerEvent) => void,
    private readonly profile: () => Profile = () => backend.active,
    private readonly agent: () => string = () => "",
    private readonly onTap: () => void = () => {},
  ) {}

  describe(subject: string) {
    this.#subject = subject;
    describeSocket(this.#socket, subject);
  }

  connect() {
    this.#redial.start();
  }

  #onWake(stale: boolean) {
    if ((nativeSockets() || !stale) && this.#socket?.readyState === WebSocket.OPEN) {
      this.#lastSeen = Date.now();
      return;
    }
    this.#redial.restart();
    this.#open(true);
  }

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.#lastSeen = Date.now();
    let beat = Date.now();
    this.#heartbeat = setInterval(() => {
      const now = Date.now();
      const throttled = now - beat > PING_MS * 2;
      beat = now;
      const socket = this.#socket;
      if (socket?.readyState !== WebSocket.OPEN) return;
      const idle = now - this.#lastSeen;
      if (idle > STALE_MS && !throttled) {
        socket.close();
        return;
      }
      if (idle >= PING_MS) this.#send({ type: "ping" });
    }, PING_MS);
  }

  #stopHeartbeat() {
    if (this.#heartbeat !== null) clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  close() {
    this.#redial.stop();
    this.#stopHeartbeat();
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
    this.resetResume();
  }

  resetResume() {
    this.#channel = null;
    this.#lastSeq = 0;
    this.forgetSide();
  }

  forgetSide() {
    this.#sideChannel = null;
    this.#sideLastSeq = 0;
    this.#sideResume = null;
  }

  sendStart(options: StartOptions) {
    this.#send({
      type: "start",
      cwd: options.cwd,
      permission_mode: options.permissionMode,
      resume: options.resume,
      fork: false,
      ...(options.account ? { account: options.account } : {}),
      model: options.model,
      effort: options.effort,
      partial: options.partial,
      visibility: options.visibility,
      locale: options.locale,
      ...(options.agent ? { agent: options.agent } : {}),
      ...(this.#channel ? { channel: this.#channel } : {}),
      last_seq: this.#lastSeq,
      capabilities: CLIENT_CAPABILITIES,
      security_key: securityKeys.current || undefined,
      ...(this.#sideChannel ? { side_channel: this.#sideChannel, side_last_seq: this.#sideLastSeq } : {}),
      ...(this.#sideResume ? { side_resume: this.#sideResume } : {}),
    });
  }

  get channel(): string | null {
    return this.#channel;
  }

  sendPrompt(prompt: string, attachments: string[] = [], id: string | null = null, channel: string | null = null) {
    return this.#send({
      type: "prompt",
      text: prompt,
      ...(attachments.length ? { attachments } : {}),
      ...(id ? { id } : {}),
      ...(channel ? { channel } : {}),
      security_key: securityKeys.current || undefined,
    });
  }

  sendUnqueue(id: string) {
    return this.#send({ type: "unqueue", id });
  }

  sendSetPermissionMode(mode: string) {
    this.#send({ type: "set_permission_mode", mode });
  }

  sendCloseResident() {
    this.#send({ type: "close_resident" });
  }

  sendSetOption(id: string, value: string | boolean) {
    this.#send({ type: "set_option", id, value });
  }

  sendAgentLogin(method: string) {
    this.#send({ type: "agent_login", method });
  }

  sendAgentLoginCancel() {
    this.#send({ type: "agent_login_cancel" });
  }

  sendAgentLogout() {
    this.#send({ type: "agent_logout" });
  }

  sendAgentRetry() {
    this.#send({ type: "agent_retry" });
  }

  sendHistory() {
    return this.#send({ type: "history" });
  }

  sendModRender(site: ModRenderSite, rid: number) {
    this.#send({
      type: "mod_render",
      component: site.component,
      instance_id: site.instanceId,
      props: site.props,
      columns: site.columns,
      rows: site.rows,
      offset: site.offset,
      rid,
    });
  }

  sendModAction(action: ModAction, fields: ModActionFields, rid?: number) {
    this.#send({ type: "mod_act", action, ...fields, ...(rid === undefined ? {} : { rid }) });
  }

  sendModClientModule(plugin: string, rid: number) {
    this.#send({ type: "mod_client_module", plugin, rid });
  }

  sendModAnswer(id: string, answer: Record<string, unknown>) {
    this.#send({ type: "mod_answer", id, answer });
  }

  sendSetGeneration(patch: GenerationPatch) {
    this.#send({ type: "set_generation", ...patch });
  }

  sendVisibility(prefs: VisibilityPrefs) {
    this.#send({ type: "set_visibility", ...prefs });
  }

  sendInterrupt(lane: string | null = null) {
    this.#send({ type: "interrupt", ...(lane ? { lane } : {}) });
  }

  sendStopTask(id: string) {
    this.#send({ type: "stop_task", id });
  }

  sendAsk(prompt: string, resume: string | null) {
    if (resume) this.#sideResume = resume;
    this.#send({ type: "ask", text: prompt, ...(resume ? { resume } : {}) });
  }

  sendUsage() {
    this.#send({ type: "usage" });
  }

  sendReload(command: string) {
    this.#send({ type: "reload", command });
  }

  sendLoadHistory(sessionId: string, project: string, beforeIndex: number, limit = 100): boolean {
    return this.#send({ type: "load_history", session_id: sessionId, project, before_index: beforeIndex, limit });
  }

  sendInteractionResponse(requestId: string, optionId: string, freeText: string | null) {
    this.#send({
      type: "interaction_response",
      id: requestId,
      option_id: optionId,
      ...(freeText?.trim() ? { free_text: freeText } : {}),
    });
  }

  sendComponentResponse(requestId: string, values: Record<string, string>) {
    const payload: Record<string, string | boolean | string[]> = {};
    for (const [key, value] of Object.entries(values)) {
      const parts = value.split(VALUE_SEPARATOR).filter(Boolean);
      if (parts.length > 1) payload[key] = parts;
      else if (value === "true" || value === "false") payload[key] = value === "true";
      else payload[key] = value;
    }
    this.#send({ type: "interaction_response", id: requestId, values: payload });
  }

  sendQuestionsChat(requestId: string, dismissedBy: "button" | "close") {
    this.#send({ type: "interaction_response", id: requestId, chat: true, dismissed_by: dismissedBy });
  }

  #send(payload: Wire) {
    const frame = JSON.stringify(payload);
    const socket = this.#socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(frame);
      return true;
    }
    if (!this.#redial.closed && socket?.readyState !== WebSocket.CONNECTING && !this.#redial.waiting) this.#open();
    return false;
  }

  #open(resumed = false) {
    const url = socketUrlOf(this.profile(), "/chat/ws");
    if (!url) return;
    const generation = ++this.#generation;
    this.#socket?.close();
    this.onEvent(false, null, { type: "connecting", resumed });
    const socket = openSocket(url, true, this.agent());
    this.#socket = socket;
    describeSocket(socket, this.#subject);
    onSocketTap(socket, () => this.onTap());

    this.#redial.dialing(socket, () => {
      if (generation !== this.#generation) return;
      socket.close();
      this.#drop("failed");
    });

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#redial.reached();
      this.#startHeartbeat();
      this.onEvent(false, null, { type: "open" });
    };
    socket.onmessage = (event) => {
      if (generation !== this.#generation) return;
      this.#lastSeen = Date.now();
      this.#parse(event.data as string);
    };
    socket.onclose = (event) => {
      if (generation === this.#generation) this.#drop(event.reason || "closed");
    };
    socket.onerror = () => {
      if (generation === this.#generation) this.#drop("failed");
    };
  }

  #drop(reason: string) {
    this.#stopHeartbeat();
    this.#redial.cancelDial();
    this.onEvent(false, null, { type: "closed", reason });
    this.#redial.later();
  }

  #parse(raw: string) {
    let wire: Wire;
    try {
      wire = JSON.parse(raw) as Wire;
    } catch {
      return;
    }
    const event = wire as unknown as Contract.ChatEvent;
    if (event.type === "pong") return;
    if (event.type === "ready") {
      const channel = event.channel ?? null;
      if (channel && channel !== this.#channel) {
        this.#channel = channel;
        this.#lastSeq = 0;
      }
      this.onEvent(false, null, {
        type: "ready",
        sessionId: event.session_id ?? null,
        project: event.project ?? null,
        cwd: event.cwd ?? null,
        account: event.account ?? null,
        channel,
        running: event.running === true,
        resumed: event.resumed === true,
        committedCount: event.committed_count ?? null,
        queued: queuedOf(event.queued),
        activity: event.activity ?? null,
        resident: event.resident === true,
        agent: event.agent ?? null,
      });
      return;
    }

    const channel = event.channel ?? null;
    if (channel !== null && this.#channel === null) return;
    const side = channel !== null && channel !== this.#channel;
    if (side && channel !== this.#sideChannel) {
      this.#sideChannel = channel;
      this.#sideLastSeq = 0;
    }

    const seq = event.seq ?? null;
    if (seq !== null) {
      const last = side ? this.#sideLastSeq : this.#lastSeq;
      if (event.type !== "interaction_request" && seq <= last) return;
      if (seq > last) {
        if (side) this.#sideLastSeq = seq;
        else this.#lastSeq = seq;
      }
    }

    const mapped = this.#toEvent(event, wire);
    if (!mapped) return;
    if (mapped.type === "ask_session") this.#sideResume = mapped.sessionId;
    this.onEvent(side, event.parent ?? null, mapped);
  }

  #toEvent(event: Contract.ChatEvent, wire: Wire): ServerEvent | null {
    switch (event.type) {
      case "assistant_text":
        return { type: "assistant_text", text: event.text ?? "" };
      case "thinking":
        return { type: "thinking", text: event.text ?? "", labelOnly: event.label === true };
      case "working":
        return { type: "working" };
      case "tool_use":
        return {
          type: "tool_use",
          id: event.id ?? null,
          name: event.name ?? null,
          mcp: event.mcp === true,
          input: event.input ?? null,
          result: event.result ?? null,
          ms: event.ms ?? null,
          query: queryOf(wire),
          statements: statementsOf(wire),
        };
      case "tool_result":
        return {
          type: "tool_result",
          toolUseId: event.tool_use_id ?? null,
          content: event.content ?? null,
          ms: event.ms ?? null,
          statements: statementsOf(wire),
        };
      case "file_change":
        return {
          type: "file_change",
          id: event.id ?? null,
          tool: event.name ?? null,
          path: event.path ?? "",
          diffLines: diffLinesOf(wire),
          labelOnly: event.label === true,
        };
      case "shared":
        return { type: "shared", id: event.id ?? null, files: sharedFilesFrom(event.files) };
      case "compacting":
        return { type: "compacting" };
      case "compacting_ended":
        return { type: "compacting_ended" };
      case "status": {
        const attempt = event.attempt ?? null;
        const delayMs = event.retry_delay_ms ?? 0;
        return {
          type: "status",
          kind: event.kind ?? "",
          retry:
            attempt === null
              ? null
              : {
                  attempt,
                  maxRetries: event.max_retries ?? attempt,
                  delayMs,
                  until: Date.now() + delayMs,
                  error: event.error ?? null,
                  noResponse: typeof event.no_response === "object" && event.no_response !== null,
                },
        };
      }
      case "terminal_opened":
        return { type: "terminal_opened", session: wire as unknown as TerminalInfo };
      case "activity":
        return {
          type: "activity",
          state: event.state === "idle" ? null : event.state,
          resident: event.resident === true,
          account: event.account ?? null,
        };
      case "agent_state":
        return { type: "agent_state", state: toAgentState(wire) };
      case "history":
        return {
          type: "history",
          items: event.items ?? [],
          startIndex: event.start_index ?? 0,
          hasMore: event.has_more === true,
        };
      case "stop":
        return { type: "stop", reason: event.reason ?? null, severity: event.severity ?? null };
      case "compact":
      case "compact_summary":
        return {
          type: event.type,
          trigger: event.trigger ?? null,
          preTokens: event.pre_tokens ?? null,
          postTokens: event.post_tokens ?? null,
          summary: event.summary ?? "",
        };
      case "ask_text":
        return { type: "ask_text", text: event.text ?? "" };
      case "ask_working":
        return { type: "ask_working" };
      case "ask_session":
        return { type: "ask_session", sessionId: event.session_id ?? "" };
      case "command":
        return { type: "command", markdown: event.markdown ?? "", local: event.local === true };
      case "usage":
        return { type: "usage", usage: usageOf(wire), local: event.local === true };
      case "component":
        return {
          type: "component",
          title: event.title ?? null,
          titleKey: event.title_key ?? null,
          icon: event.icon ?? null,
          blocks: (event.blocks ?? []).flatMap(toElement),
          local: event.local === true,
        };
      case "reloaded":
        return {
          type: "reloaded",
          command: event.command ?? "",
          resident: event.resident === true,
          failed: event.failed === true,
          plugins: event.plugins ?? null,
          commands: event.commands ?? null,
          agents: event.agents ?? null,
          mcpServers: event.mcp_servers ?? null,
          errors: event.errors ?? 0,
        };
      case "rejected":
        return { type: "rejected", request: event.request ?? null, message: event.message ?? "" };
      case "notification":
        return { type: "notification", summary: event.text ?? "", status: event.result ?? null };
      case "notice":
        return { type: "notice", name: event.name ?? null, text: event.text ?? "", level: event.level ?? null };
      case "mods":
        return { type: "mods", state: toModState(wire) };
      case "commands":
        return { type: "commands", commands: toCommands((event.commands ?? []) as CommandWire[]) };
      case "mod_toast":
        return {
          type: "mod_toast",
          plugin: event.plugin ?? null,
          text: event.text ?? "",
          timeoutMs: event.timeout_ms ?? null,
        };
      case "mod_invalidate":
        return { type: "mod_invalidate", instances: toModSiteTargets(event.instances) };
      case "mod_tree":
        return {
          type: "mod_tree",
          rid: event.rid ?? 0,
          component: toModComponent(event.component),
          instanceId: event.instance_id ?? "",
          drawn: toModDrawn(wire),
        };
      case "mod_reply":
        return { type: "mod_reply", rid: event.rid ?? 0, answer: event.answer ?? null };
      case "mod_request": {
        const request = toModRequest(wire);
        return request ? { type: "mod_request", request } : null;
      }
      case "mod_focus":
        return {
          type: "mod_focus",
          component: toModComponent(event.component),
          instanceId: event.instance_id ?? "",
          plugin: event.plugin ?? "",
          key: event.key ?? "",
        };
      case "mod_scroll":
        return {
          type: "mod_scroll",
          component: toModComponent(event.component),
          instanceId: event.instance_id ?? "",
          offset: event.offset ?? 0,
          followEnd: event.follow_end === true,
        };
      case "session_message":
      case "plugin_message":
        return { type: event.type, name: event.name ?? null, text: event.text ?? "" };
      case "agent_report":
        return { type: "agent_report", name: event.name ?? null, text: event.text ?? "" };
      case "queued":
        return { type: "queued", id: event.id ?? null, text: event.text ?? "", replay: event.replay === true };
      case "queue":
        return { type: "queue", items: queuedOf(event.items) };
      case "dequeued":
        return {
          type: "dequeued",
          ids: (event.ids ?? []).filter((id): id is string => typeof id === "string"),
          text: event.text ?? null,
          ts: event.ts ?? null,
        };
      case "agent":
        return { type: "agent", id: event.id ?? null, ...agentFieldsOf(wire) };
      case "task_running":
        return { type: "task_running", id: event.id ?? null, description: event.description ?? null };
      case "agent_result":
        return {
          type: "agent_result",
          id: event.id ?? null,
          status: event.status ?? null,
          durationMs: event.duration_ms ?? null,
          tokens: event.tokens ?? null,
          toolUses: event.tool_uses ?? null,
        };
      case "thinking_tokens":
        return { type: "thinking_tokens", tokens: event.tokens ?? 0 };
      case "hook_failed":
        return { type: "hook_failed", name: event.name ?? null, text: event.text ?? "" };
      case "todos":
        return {
          type: "todos",
          items: (event.items ?? []).map((item) => ({
            id: null,
            content: item.content ?? "",
            status: item.status ?? "pending",
            activeForm: item.active_form ?? "",
          })),
        };
      case "task":
        return { type: "task", id: event.id ?? "", content: event.content ?? null, status: event.status ?? null };
      case "session_started":
        return { type: "session_started", sessionId: event.session_id ?? null };
      case "result":
        return { type: "result", sessionId: event.session_id ?? null };
      case "context":
        return {
          type: "context",
          contextTokens: event.context_tokens ?? null,
          contextWindow: event.context_window ?? null,
          requestBytes: event.request_bytes ?? null,
          mediaBytes: event.media_bytes ?? null,
        };
      case "rate_limit":
        return {
          type: "rate_limit",
          windows: (event.windows ?? []).map((window) => ({
            id: window.id ?? "",
            percent: window.percent ?? 0,
            severity: window.severity ?? null,
          })),
        };
      case "cache":
        return { type: "cache", cache: promptCacheOf(event.cache) };
      case "anchor":
        return event.uuid ? { type: "anchor", uuid: event.uuid } : null;
      case "done":
        return { type: "done", replay: event.replay === true };
      case "interrupted":
        return { type: "interrupted" };
      case "attached":
        return { type: "attached" };
      case "error":
        return { type: "error", message: event.message ?? "error" };
      case "api_error":
        return { type: "api_error", message: event.text ?? "", severity: event.severity ?? null };
      case "tail":
        return { type: "tail", items: event.items ?? [] };
      case "history_chunk":
        return {
          type: "history_chunk",
          sessionId: event.session_id ?? "",
          startIndex: event.start_index ?? 0,
          items: event.items ?? [],
          hasMore: event.has_more === true,
        };
      case "interaction_request":
        return {
          type: "interaction_request",
          replay: event.replay === true,
          requestId: event.id ?? "",
          kind: event.kind ?? "permission",
          toolName: event.tool_name ?? null,
          toolUseId: event.tool_use_id ?? null,
          input: event.input ?? null,
          title: event.title ?? null,
          titleKey: event.title_key ?? null,
          icon: event.icon ?? null,
          options: (event.options ?? []).map(toOption),
          blocks: (event.blocks ?? []).flatMap(toElement),
          submitLabel: event.submit ?? null,
          submitKey: event.submit_key ?? null,
          dismiss: toDismiss(event.dismiss),
          present: event.present ?? null,
          variant: event.variant ?? null,
          mod: toInteractionMod(event.mod),
        };
      case "interaction_resolved":
        return {
          type: "interaction_resolved",
          requestId: event.id ?? "",
          optionId: event.option_id ?? null,
          values: toValues(event.values),
          dismissed: event.dismissed === true,
        };
      default:
        return null;
    }
  }
}
