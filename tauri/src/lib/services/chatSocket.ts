import {
  diffKindOf,
  VALUE_SEPARATOR,
  type ComponentElement,
  type ComponentOption,
  type DiffLine,
  type InteractionOption,
  type QueuedMessage,
  type TodoItem,
} from "$lib/data/chatModels";
import { backend, baseUrlOf, socketUrlOf, type Profile } from "./backend.svelte";
import type { VisibilityPrefs } from "$lib/data/settings.svelte";

export type ServerEvent =
  | { type: "connecting" }
  | { type: "open" }
  | {
      type: "ready";
      sessionId: string | null;
      project: string | null;
      channel: string | null;
      running: boolean;
      resumed: boolean;
      committedCount: number | null;
      queued: QueuedMessage[];
      activity: string | null;
    }
  | { type: "activity"; state: string | null }
  | { type: "assistant_text"; text: string }
  | { type: "thinking"; text: string; labelOnly: boolean }
  | { type: "working" }
  | { type: "tool_use"; id: string | null; name: string | null; input: string | null; result: string | null }
  | { type: "tool_result"; toolUseId: string | null; content: string | null }
  | { type: "file_change"; id: string | null; path: string; diffLines: DiffLine[]; labelOnly: boolean }
  | { type: "compacting"; trigger: string | null }
  | { type: "status"; kind: string }
  | { type: "compact"; trigger: string | null; preTokens: number | null; postTokens: number | null; summary: string }
  | {
      type: "compact_summary";
      trigger: string | null;
      preTokens: number | null;
      postTokens: number | null;
      summary: string;
    }
  | { type: "ask_text"; text: string }
  | { type: "ask_working" }
  | { type: "ask_session"; sessionId: string }
  | { type: "ask_done" }
  | { type: "command"; markdown: string }
  | {
      type: "component";
      title: string | null;
      titleKey: string | null;
      icon: string | null;
      blocks: ComponentElement[];
    }
  | { type: "plan"; markdown: string }
  | { type: "agent"; id: string | null; subagentType: string | null; description: string | null; labelOnly: boolean }
  | { type: "notification"; summary: string; status: string | null }
  | { type: "todos"; items: TodoItem[] }
  | { type: "task"; id: string; content: string | null; status: string | null }
  | { type: "result"; sessionId: string | null; contextTokens: number | null }
  | { type: "context"; contextTokens: number | null }
  | { type: "done"; replay: boolean }
  | { type: "interrupted" }
  | { type: "attached" }
  | { type: "error"; message: string }
  | { type: "api_error"; message: string }
  | { type: "closed"; reason: string }
  | { type: "queued"; id: string | null; text: string }
  | { type: "dequeued"; ids: string[]; text: string | null }
  | {
      type: "history_chunk";
      sessionId: string;
      startIndex: number;
      items: Record<string, unknown>[];
      hasMore: boolean;
    }
  | {
      type: "interaction_request";
      replay: boolean;
      requestId: string;
      kind: string;
      toolName: string | null;
      toolUseId: string | null;
      input: string | null;
      title: string | null;
      titleKey: string | null;
      icon: string | null;
      options: InteractionOption[];
      blocks: ComponentElement[];
      submitLabel: string | null;
      submitKey: string | null;
      dismiss: ComponentOption | null;
    }
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
}

export interface GenerationPatch {
  model?: string;
  effort?: string;
  partial?: boolean;
  account?: string;
  cwd?: string;
}

type Wire = Record<string, unknown>;

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_SHIFT = 4;
const PING_MS = 20_000;
const STALE_MS = 45_000;
const CLIENT_CAPABILITIES = ["media.blocks", "media.rich", "components"];

const text = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);
const int = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);
const flag = (raw: Wire, key: string): boolean => raw[key] === true;
const number = (raw: Wire, key: string): number | null =>
  typeof raw[key] === "number" ? (raw[key] as number) : null;
const list = (raw: Wire, key: string): Wire[] => (Array.isArray(raw[key]) ? (raw[key] as Wire[]) : []);
const strings = (raw: Wire, key: string): string[] =>
  Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];

const queuedItems = (raw: Wire): QueuedMessage[] =>
  list(raw, "queued")
    .map((item) => ({
      id: text(item, "id") ?? "",
      text: text(item, "text") ?? "",
      attachments: strings(item, "attachments"),
      uploading: false,
    }))
    .filter((item) => item.id !== "");

const toOption = (raw: Wire): InteractionOption => ({
  id: text(raw, "id") ?? "",
  label: text(raw, "label"),
  description: text(raw, "description"),
  preview: text(raw, "preview"),
});

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
  "notes",
  "bar",
] as const;

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
  };
};

export const toElement = (raw: Wire): ComponentElement[] => {
  const type = text(raw, "type") as ComponentElement["type"] | null;
  if (!type || !COMPONENT_TYPES.includes(type)) return [];
  const value = raw.value;
  return [
    {
      type,
      id: text(raw, "id"),
      label: text(raw, "label"),
      text:
        type === "bar" || type === "text"
          ? (text(raw, "text") ?? (typeof value === "string" ? value : null))
          : null,
      placeholder: text(raw, "placeholder"),
      placeholderKey: text(raw, "placeholder_key"),
      value:
        type === "bar"
          ? String(value ?? 0)
          : type === "input" && typeof value === "string"
            ? value
            : null,
      color: text(raw, "color"),
      alertAbove: number(raw, "alert_above"),
      alertBelow: number(raw, "alert_below"),
      checked: value === true,
      multiline: flag(raw, "multiline"),
      lines: number(raw, "lines"),
      secret: flag(raw, "secret"),
      multiple: flag(raw, "multiple"),
      required: flag(raw, "required"),
      options: list(raw, "options").map((option) => ({
        value: text(option, "value") ?? "",
        label: text(option, "label") ?? "",
        description: text(option, "description"),
        preview: text(option, "preview"),
        style: text(option, "style"),
        icon: text(option, "icon"),
        labelKey: text(option, "label_key"),
      })),
      block: raw.block && typeof raw.block === "object" ? JSON.stringify(raw.block) : null,
      blocks: list(raw, "blocks").flatMap(toElement),
    },
  ];
};

export class ChatSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #closed = true;
  #attempts = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #lastSeen = 0;
  #channel: string | null = null;
  #lastSeq = 0;
  #sideChannel: string | null = null;
  #sideLastSeq = 0;
  #sideResume: string | null = null;

  constructor(
    private readonly onEvent: (side: boolean, parent: string | null, event: ServerEvent) => void,
    private readonly profile: () => Profile = () => backend.active,
  ) {}

  connect() {
    this.#closed = false;
    this.#attempts = 0;
    this.#clearTimer();
    this.#open();
    document.addEventListener("visibilitychange", this.#onVisible);
  }

  #onVisible = () => {
    if (this.#closed || document.visibilityState !== "visible") return;
    this.#lastSeen = Date.now();
    if (this.#socket?.readyState === WebSocket.OPEN) return;
    this.#attempts = 0;
    this.#clearTimer();
    this.#open();
  };

  #startHeartbeat() {
    this.#stopHeartbeat();
    this.#lastSeen = Date.now();
    this.#heartbeat = setInterval(() => {
      const socket = this.#socket;
      if (socket?.readyState !== WebSocket.OPEN) return;
      const idle = Date.now() - this.#lastSeen;
      if (idle > STALE_MS) {
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
    this.#closed = true;
    this.#stopHeartbeat();
    document.removeEventListener("visibilitychange", this.#onVisible);
    this.#clearTimer();
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
    this.resetResume();
  }

  resetResume() {
    this.#channel = null;
    this.#lastSeq = 0;
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
      base_url: baseUrlOf(this.profile()),
      ...(this.#channel ? { channel: this.#channel } : {}),
      last_seq: this.#lastSeq,
      capabilities: CLIENT_CAPABILITIES,
      ...(this.#sideChannel ? { side_channel: this.#sideChannel, side_last_seq: this.#sideLastSeq } : {}),
      ...(this.#sideResume ? { side_resume: this.#sideResume } : {}),
    });
  }

  sendPrompt(prompt: string, attachments: string[] = [], id: string | null = null) {
    return this.#send({
      type: "prompt",
      text: prompt,
      ...(attachments.length ? { attachments } : {}),
      ...(id ? { id } : {}),
    });
  }

  sendUnqueue(id: string) {
    return this.#send({ type: "unqueue", id });
  }

  sendSetPermissionMode(mode: string) {
    this.#send({ type: "set_permission_mode", mode });
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

  sendAsk(prompt: string, resume: string | null) {
    if (resume) this.#sideResume = resume;
    this.#send({ type: "ask", text: prompt, ...(resume ? { resume } : {}) });
  }

  sendUsage() {
    this.#send({ type: "usage" });
  }

  sendLoadHistory(sessionId: string, project: string, beforeIndex: number, limit = 100) {
    this.#send({ type: "load_history", session_id: sessionId, project, before_index: beforeIndex, limit });
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

  sendQuestionsChat(requestId: string) {
    this.#send({ type: "interaction_response", id: requestId, chat: true });
  }

  #send(payload: Wire) {
    const frame = JSON.stringify(payload);
    const socket = this.#socket;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(frame);
      return true;
    }
    if (!this.#closed && socket?.readyState !== WebSocket.CONNECTING && this.#timer === null) {
      this.#clearTimer();
      this.#open();
    }
    return false;
  }

  #clearTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #open() {
    const url = socketUrlOf(this.profile(), "/chat/ws");
    if (!url) return;
    const generation = ++this.#generation;
    this.#socket?.close();
    this.onEvent(false, null, { type: "connecting" });
    const socket = new WebSocket(url);
    this.#socket = socket;

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#attempts = 0;
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
    this.onEvent(false, null, { type: "closed", reason });
    if (this.#closed || this.#timer !== null) return;
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS << Math.min(this.#attempts, MAX_BACKOFF_SHIFT));
    this.#attempts++;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#closed) this.#open();
    }, backoff);
  }

  #parse(raw: string) {
    let wire: Wire;
    try {
      wire = JSON.parse(raw) as Wire;
    } catch {
      return;
    }

    const kind = text(wire, "type");
    if (kind === "pong") return;
    if (kind === "ready") {
      const channel = text(wire, "channel");
      if (channel && channel !== this.#channel) {
        this.#channel = channel;
        this.#lastSeq = 0;
      }
      this.onEvent(false, null, {
        type: "ready",
        sessionId: text(wire, "session_id"),
        project: text(wire, "project"),
        channel,
        running: flag(wire, "running"),
        resumed: flag(wire, "resumed"),
        committedCount: int(wire, "committed_count"),
        queued: queuedItems(wire),
        activity: text(wire, "activity"),
      });
      return;
    }

    const channel = text(wire, "channel");
    const side = channel !== null && this.#channel !== null && channel !== this.#channel;
    if (side && channel !== this.#sideChannel) {
      this.#sideChannel = channel;
      this.#sideLastSeq = 0;
    }

    const seq = int(wire, "seq");
    if (seq !== null) {
      const last = side ? this.#sideLastSeq : this.#lastSeq;
      if (kind !== "interaction_request" && seq <= last) return;
      if (seq > last) {
        if (side) this.#sideLastSeq = seq;
        else this.#lastSeq = seq;
      }
    }

    const event = this.#toEvent(kind, wire);
    if (!event) return;
    if (event.type === "ask_session") this.#sideResume = event.sessionId;
    this.onEvent(side, text(wire, "parent"), event);
  }

  #toEvent(kind: string | null, wire: Wire): ServerEvent | null {
    switch (kind) {
      case "assistant_text":
        return { type: "assistant_text", text: text(wire, "text") ?? "" };
      case "thinking":
        return { type: "thinking", text: text(wire, "text") ?? "", labelOnly: flag(wire, "label") };
      case "working":
        return { type: "working" };
      case "tool_use":
        return {
          type: "tool_use",
          id: text(wire, "id"),
          name: text(wire, "name"),
          input: text(wire, "input"),
          result: text(wire, "result"),
        };
      case "tool_result":
        return { type: "tool_result", toolUseId: text(wire, "tool_use_id"), content: text(wire, "content") };
      case "file_change":
        return {
          type: "file_change",
          id: text(wire, "id"),
          path: text(wire, "path") ?? "",
          diffLines: list(wire, "diff_lines").map((line) => ({
            kind: diffKindOf(text(line, "kind")),
            text: text(line, "text") ?? "",
          })),
          labelOnly: flag(wire, "label"),
        };
      case "compacting":
        return { type: "compacting", trigger: text(wire, "trigger") };
      case "status":
        return { type: "status", kind: text(wire, "kind") ?? "" };
      case "activity": {
        const state = text(wire, "state");
        return { type: "activity", state: state === "idle" ? null : state };
      }
      case "compact":
      case "compact_summary":
        return {
          type: kind,
          trigger: text(wire, "trigger"),
          preTokens: int(wire, "pre_tokens"),
          postTokens: int(wire, "post_tokens"),
          summary: text(wire, "summary") ?? "",
        };
      case "ask_text":
        return { type: "ask_text", text: text(wire, "text") ?? "" };
      case "ask_working":
        return { type: "ask_working" };
      case "ask_session":
        return { type: "ask_session", sessionId: text(wire, "session_id") ?? "" };
      case "ask_done":
        return { type: "ask_done" };
      case "command":
        return { type: "command", markdown: text(wire, "markdown") ?? "" };
      case "component":
        return {
          type: "component",
          title: text(wire, "title"),
          titleKey: text(wire, "title_key"),
          icon: text(wire, "icon"),
          blocks: list(wire, "blocks").flatMap(toElement),
        };
      case "plan":
        return { type: "plan", markdown: text(wire, "markdown") ?? "" };
      case "notification":
        return { type: "notification", summary: text(wire, "text") ?? "", status: text(wire, "result") };
      case "queued":
        return { type: "queued", id: text(wire, "id"), text: text(wire, "text") ?? "" };
      case "dequeued":
        return {
          type: "dequeued",
          ids: (Array.isArray(wire.ids) ? (wire.ids as unknown[]) : []).filter(
            (id): id is string => typeof id === "string",
          ),
          text: text(wire, "text"),
        };
      case "agent":
        return {
          type: "agent",
          id: text(wire, "id"),
          subagentType: text(wire, "subagent_type"),
          description: text(wire, "description"),
          labelOnly: flag(wire, "label"),
        };
      case "todos":
        return {
          type: "todos",
          items: list(wire, "items").map((item) => ({
            id: null,
            content: text(item, "content") ?? "",
            status: text(item, "status") ?? "pending",
            activeForm: text(item, "active_form") ?? "",
          })),
        };
      case "task":
        return { type: "task", id: text(wire, "id") ?? "", content: text(wire, "content"), status: text(wire, "status") };
      case "result":
        return { type: "result", sessionId: text(wire, "session_id"), contextTokens: int(wire, "context_tokens") };
      case "context":
        return { type: "context", contextTokens: int(wire, "context_tokens") };
      case "done":
        return { type: "done", replay: wire.replay === true };
      case "interrupted":
        return { type: "interrupted" };
      case "attached":
        return { type: "attached" };
      case "error":
        return { type: "error", message: text(wire, "message") ?? "error" };
      case "api_error":
        return { type: "api_error", message: text(wire, "text") ?? "" };
      case "history_chunk":
        return {
          type: "history_chunk",
          sessionId: text(wire, "session_id") ?? "",
          startIndex: int(wire, "start_index") ?? 0,
          items: list(wire, "items"),
          hasMore: wire.has_more === true || wire.has_more === "true",
        };
      case "interaction_request":
        return {
          type: "interaction_request",
          replay: wire.replay === true,
          requestId: text(wire, "id") ?? "",
          kind: text(wire, "kind") ?? "permission",
          toolName: text(wire, "tool_name"),
          toolUseId: text(wire, "tool_use_id"),
          input: text(wire, "input"),
          title: text(wire, "title"),
          titleKey: text(wire, "title_key"),
          icon: text(wire, "icon"),
          options: list(wire, "options").map(toOption),
          blocks: list(wire, "blocks").flatMap(toElement),
          submitLabel: text(wire, "submit"),
          submitKey: text(wire, "submit_key"),
          dismiss: toDismiss(wire.dismiss),
        };
      case "interaction_resolved":
        return {
          type: "interaction_resolved",
          requestId: text(wire, "id") ?? "",
          optionId: text(wire, "option_id"),
          values: toValues(wire.values),
          dismissed: flag(wire, "dismissed"),
        };
      default:
        return null;
    }
  }
}
