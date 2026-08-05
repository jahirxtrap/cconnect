import {
  diffKindOf,
  type DiffLine,
  type InteractionOption,
  type InteractionQuestion,
  type QuestionDraft,
  type TodoItem,
} from "$lib/data/chatModels";
import { backend, baseUrlOf, socketUrlOf, type Profile } from "./backend.svelte";

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
    }
  | { type: "assistant_text"; text: string }
  | { type: "thinking"; text: string; labelOnly: boolean }
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
  | { type: "plan"; markdown: string }
  | { type: "agent"; id: string | null; subagentType: string | null; description: string | null; labelOnly: boolean }
  | { type: "notification"; summary: string; status: string | null }
  | { type: "todos"; items: TodoItem[] }
  | { type: "task"; id: string; content: string | null; status: string | null }
  | { type: "result"; sessionId: string | null; contextTokens: number | null }
  | { type: "context"; contextTokens: number | null }
  | { type: "done" }
  | { type: "interrupted" }
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
      requestId: string;
      kind: string;
      toolName: string | null;
      toolUseId: string | null;
      input: string | null;
      title: string | null;
      options: InteractionOption[];
      questions: InteractionQuestion[];
    }
  | { type: "interaction_resolved"; requestId: string; optionId: string | null };

export interface StartOptions {
  cwd: string;
  permissionMode: string;
  resume: string | null;
  model: string;
  effort: string;
  partial: boolean;
  account: string;
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

const text = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);
const int = (raw: Wire, key: string): number | null => (typeof raw[key] === "number" ? (raw[key] as number) : null);
const flag = (raw: Wire, key: string): boolean => raw[key] === true;
const list = (raw: Wire, key: string): Wire[] => (Array.isArray(raw[key]) ? (raw[key] as Wire[]) : []);

const toOption = (raw: Wire): InteractionOption => ({
  id: text(raw, "id") ?? "",
  label: text(raw, "label"),
  description: text(raw, "description"),
  preview: text(raw, "preview"),
});

export class ChatSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #closed = true;
  #attempts = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;

  #buffered: string[] = [];
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
  }

  close() {
    this.#closed = true;
    this.#clearTimer();
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
    this.#buffered = [];
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
      base_url: baseUrlOf(this.profile()),
      ...(this.#channel ? { channel: this.#channel } : {}),
      last_seq: this.#lastSeq,
      ...(this.#sideChannel ? { side_channel: this.#sideChannel, side_last_seq: this.#sideLastSeq } : {}),
      ...(this.#sideResume ? { side_resume: this.#sideResume } : {}),
    });
  }

  sendPrompt(prompt: string, attachments: string[] = [], id: string | null = null) {
    this.#send({
      type: "prompt",
      text: prompt,
      ...(attachments.length ? { attachments } : {}),
      ...(id ? { id } : {}),
    });
  }

  sendSetPermissionMode(mode: string) {
    this.#send({ type: "set_permission_mode", mode });
  }

  sendSetGeneration(patch: GenerationPatch) {
    this.#send({ type: "set_generation", ...patch });
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

  sendQuestionsResponse(requestId: string, answers: QuestionDraft[]) {
    this.#send({
      type: "interaction_response",
      id: requestId,
      answers: answers.map((draft) => ({
        selected: draft.selected,
        ...(draft.freeText.trim() ? { free_text: draft.freeText } : {}),
        ...(draft.notes.trim() ? { notes: draft.notes } : {}),
      })),
    });
  }

  sendQuestionsChat(requestId: string) {
    this.#send({ type: "interaction_response", id: requestId, chat: true });
  }

  #send(payload: Wire) {
    const frame = JSON.stringify(payload);
    const socket = this.#socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(frame);
    else if (socket?.readyState === WebSocket.CONNECTING) this.#buffered.push(frame);
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
    this.#buffered = [];
    this.onEvent(false, null, { type: "connecting" });
    const socket = new WebSocket(url);
    this.#socket = socket;

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#attempts = 0;
      const buffered = this.#buffered;
      this.#buffered = [];
      buffered.forEach((frame) => socket.send(frame));
      this.onEvent(false, null, { type: "open" });
    };
    socket.onmessage = (event) => {
      if (generation !== this.#generation) return;
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
    this.#buffered = [];
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
        return { type: "done" };
      case "interrupted":
        return { type: "interrupted" };
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
          requestId: text(wire, "id") ?? "",
          kind: text(wire, "kind") ?? "permission",
          toolName: text(wire, "tool_name"),
          toolUseId: text(wire, "tool_use_id"),
          input: text(wire, "input"),
          title: text(wire, "title"),
          options: list(wire, "options").map(toOption),
          questions: list(wire, "questions").map((question) => ({
            header: text(question, "header"),
            question: text(question, "question"),
            multiSelect: flag(question, "multi_select"),
            options: list(question, "options").map(toOption),
          })),
        };
      case "interaction_resolved":
        return { type: "interaction_resolved", requestId: text(wire, "id") ?? "", optionId: text(wire, "option_id") };
      default:
        return null;
    }
  }
}
