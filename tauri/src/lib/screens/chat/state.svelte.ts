import { chatList } from "$lib/data/chatList.svelte";
import {
  emptyInteraction,
  isPending,
  message as newMessage,
  type ChatMessage,
  type ConnectionState,
  type InteractionData,
  type Role,
  type TodoItem,
} from "$lib/data/chatModels";
import type { SessionInfo } from "$lib/data/models";
import { settings } from "$lib/data/settings.svelte";
import { backend } from "$lib/services/backend.svelte";
import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
import { ChatSocket, type ServerEvent } from "$lib/services/chatSocket";
import { sessionsApi } from "$lib/services/sessionsApi";

const DEFAULTS = {
  permissionMode: "bypassPermissions",
  model: "opus[1m]",
  effort: "xhigh",
  account: "default",
};

class ChatState {
  connection = $state<ConnectionState>("connecting");
  messages = $state<ChatMessage[]>([]);
  streaming = $state(false);
  compacting = $state(false);
  streamStatus = $state<string | null>(null);
  todos = $state<TodoItem[]>([]);
  contextTokens = $state<number | null>(null);
  pendingToolIds = $state<string[]>([]);

  sessionId = $state<string | null>(null);
  projectKey = $state<string | null>(null);
  cwd = $state(settings.cwd);

  permissionMode = $state(DEFAULTS.permissionMode);
  model = $state(DEFAULTS.model);
  effort = $state(DEFAULTS.effort);
  account = $state(DEFAULTS.account);
  streamTokens = $state(true);
  capabilities = $state<Capabilities | null>(null);

  historyProjectKey = $state<string | null>(null);

  readonly historySessions = $derived(chatList.sessionsOf(this.historyProjectKey));
  readonly connected = $derived(this.connection === "connected");

  #socket = new ChatSocket((side, parent, event) => this.#onEvent(side, parent, event));
  #nextId = 1;
  #assistantId: number | null = null;
  #thinkingId: number | null = null;

  start() {
    $effect(() => {
      void backend.baseUrl;
      this.#socket.close();
      this.#socket.resetResume();
      this.#socket.connect();
      void this.#loadCapabilities();
      return () => this.#socket.close();
    });
  }

  send(text: string) {
    const body = text.trim();
    if (!body) return;
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#append(newMessage(this.#nextId++, "user", { text: body }));
    this.streaming = true;
    this.streamStatus = null;
    this.#socket.sendPrompt(body);
  }

  interrupt() {
    this.#socket.sendInterrupt();
  }

  newSession() {
    this.sessionId = null;
    this.messages = [];
    this.todos = [];
    this.contextTokens = null;
    this.streaming = false;
    this.#socket.resetResume();
    this.#startSession(null);
  }

  openSession(session: SessionInfo) {
    this.sessionId = session.sessionId;
    this.projectKey = session.projectKey;
    if (session.path) {
      this.cwd = session.path;
      settings.cwd = session.path;
    }
    this.messages = [];
    this.todos = [];
    this.contextTokens = null;
    this.#socket.resetResume();
    this.#startSession(session.sessionId);
  }

  selectHistoryProject(projectKey: string | null) {
    this.historyProjectKey = projectKey;
  }

  answerInteraction(requestId: string, optionId: string) {
    this.#socket.sendInteractionResponse(requestId, optionId, null);
    this.#updateInteraction(requestId, (data) => ({ ...data, resolved: optionId }));
  }

  setPermissionMode(mode: string) {
    this.permissionMode = mode;
    this.#socket.sendSetPermissionMode(mode);
  }

  setModel(model: string) {
    this.model = model;
    this.#socket.sendSetGeneration({ model });
  }

  setEffort(effort: string) {
    this.effort = effort;
    this.#socket.sendSetGeneration({ effort });
  }

  setAccount(account: string) {
    this.account = account;
    this.#socket.sendSetGeneration({ account });
  }

  async autoRename(session: SessionInfo) {
    if (session.projectKey) await sessionsApi.autoRename(session.sessionId, session.projectKey);
  }

  async rename(session: SessionInfo, title: string) {
    if (session.projectKey) await sessionsApi.rename(session.sessionId, session.projectKey, title);
  }

  async setColor(session: SessionInfo, color: string) {
    if (session.projectKey) await sessionsApi.setColor(session.sessionId, session.projectKey, color);
  }

  async remove(session: SessionInfo) {
    if (!session.projectKey) return;
    await sessionsApi.remove(session.sessionId, session.projectKey);
    if (this.sessionId === session.sessionId) this.newSession();
  }

  async #loadCapabilities() {
    const capabilities = await capabilitiesApi.capabilities();
    if (!capabilities) return;
    this.capabilities = capabilities;
    this.permissionMode = capabilities.defaults.permissionMode || this.permissionMode;
    this.model = capabilities.defaults.model || this.model;
    this.effort = capabilities.defaults.effort || this.effort;
    this.account = capabilities.defaults.account || this.account;
  }

  #startSession(resume: string | null) {
    this.#socket.sendStart({
      cwd: this.cwd,
      permissionMode: this.permissionMode,
      resume,
      model: this.model,
      effort: this.effort,
      partial: this.streamTokens,
      account: this.account,
    });
  }

  #append(item: ChatMessage) {
    this.messages = [...this.messages, item];
  }

  #stream(currentId: number | null, role: Role, text: string): number {
    if (currentId !== null) {
      this.messages = this.messages.map((item) =>
        item.id === currentId ? { ...item, text: item.text + text } : item,
      );
      return currentId;
    }
    const id = this.#nextId++;
    this.#append(newMessage(id, role, { text }));
    return id;
  }

  #updateInteraction(requestId: string, transform: (data: InteractionData) => InteractionData) {
    this.messages = this.messages.map((item) =>
      item.interaction?.requestId === requestId
        ? { ...item, interaction: transform(item.interaction) }
        : item,
    );
  }

  #resetStreaming() {
    this.streaming = false;
    this.compacting = false;
    this.streamStatus = null;
    this.pendingToolIds = [];
    this.#assistantId = null;
    this.#thinkingId = null;
  }

  #onEvent(side: boolean, parent: string | null, event: ServerEvent) {
    if (side || parent !== null) return;
    switch (event.type) {
      case "connecting":
        if (this.connection !== "connected") this.connection = "connecting";
        break;
      case "open":
        this.#startSession(this.sessionId);
        break;
      case "ready": {
        this.connection = "connected";
        this.sessionId = event.sessionId ?? this.sessionId;
        this.projectKey = event.project ?? this.projectKey;
        this.streaming = event.running;
        const kept = this.messages.filter((item) => !item.ephemeral);
        this.messages =
          event.resumed && event.running && event.committedCount !== null
            ? kept.filter((item) => item.sourceIndex >= 0 && item.sourceIndex < event.committedCount!)
            : kept;
        break;
      }
      case "assistant_text":
        this.#thinkingId = null;
        this.#assistantId = this.#stream(this.#assistantId, "assistant", event.text);
        break;
      case "thinking":
        if (event.labelOnly) {
          this.#assistantId = null;
          this.#thinkingId = null;
          this.#append(newMessage(this.#nextId++, "thinking", { labelOnly: true }));
        } else if (event.text) {
          this.#assistantId = null;
          this.#thinkingId = this.#stream(this.#thinkingId, "thinking", event.text);
        }
        break;
      case "plan":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "plan", { text: event.markdown }));
        break;
      case "command":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "assistant", { text: event.markdown, ephemeral: true }));
        break;
      case "notification":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "notification", { text: event.summary, result: event.status }));
        break;
      case "agent":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "agent", {
            text: event.description ?? "",
            toolName: event.subagentType,
            toolUseId: event.id,
            labelOnly: event.labelOnly,
          }),
        );
        if (event.id) this.pendingToolIds = [...this.pendingToolIds, event.id];
        break;
      case "tool_use":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "tool", {
            text: event.input ?? "",
            toolName: event.name,
            toolUseId: event.id,
            result: event.result,
          }),
        );
        if (event.id) this.pendingToolIds = [...this.pendingToolIds, event.id];
        break;
      case "tool_result":
        if (event.toolUseId) {
          const toolUseId = event.toolUseId;
          this.pendingToolIds = this.pendingToolIds.filter((id) => id !== toolUseId);
          if (event.content !== null) {
            this.messages = this.messages.map((item) =>
              item.toolUseId === toolUseId ? { ...item, result: event.content } : item,
            );
          }
        }
        break;
      case "file_change":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "file_change", {
            toolUseId: event.id,
            path: event.path,
            diffLines: event.diffLines,
            labelOnly: event.labelOnly,
          }),
        );
        break;
      case "compacting":
        this.compacting = true;
        break;
      case "status":
        this.streamStatus = event.kind === "ok" ? null : event.kind;
        break;
      case "compact":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.messages = [
          newMessage(this.#nextId++, "compact", {
            compact: {
              trigger: event.trigger,
              preTokens: event.preTokens,
              postTokens: event.postTokens,
              summary: event.summary,
            },
          }),
        ];
        this.compacting = false;
        break;
      case "compact_summary":
        this.messages = this.messages.map((item) =>
          item.role === "compact" && item.compact
            ? {
                ...item,
                compact: {
                  trigger: event.trigger,
                  preTokens: event.preTokens,
                  postTokens: event.postTokens,
                  summary: event.summary,
                },
              }
            : item,
        );
        break;
      case "todos":
        this.todos = event.items;
        break;
      case "context":
        this.contextTokens = event.contextTokens ?? this.contextTokens;
        break;
      case "result":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.sessionId = event.sessionId ?? this.sessionId;
        this.contextTokens = event.contextTokens ?? this.contextTokens;
        break;
      case "done":
        this.#resetStreaming();
        break;
      case "interrupted":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.messages = this.messages.filter(
          (item) => !(item.role === "interaction" && item.interaction && isPending(item.interaction)),
        );
        this.#append(newMessage(this.#nextId++, "interrupted"));
        this.streaming = false;
        this.compacting = false;
        this.pendingToolIds = [];
        break;
      case "error": {
        this.#resetStreaming();
        const index = this.messages.findLastIndex((item) => item.role === "user");
        if (index >= 0) {
          this.messages = this.messages.map((item, i) =>
            i === index ? { ...item, sendStatus: "error" as const } : item,
          );
        }
        break;
      }
      case "api_error":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.streamStatus = null;
        this.#append(newMessage(this.#nextId++, "api_error", { text: event.message }));
        break;
      case "interaction_request":
        if (!this.messages.some((item) => item.interaction?.requestId === event.requestId)) {
          this.#assistantId = null;
          this.#thinkingId = null;
          const data: InteractionData = {
            ...emptyInteraction(event.requestId, event.kind),
            options: event.options,
            title: event.title,
            questions: event.questions,
            drafts: event.questions.map(() => ({ selected: [], freeText: "", notes: "" })),
          };
          const toolUseId = event.toolUseId;
          this.messages = [
            ...this.messages.filter((item) => !(item.role === "tool" && item.toolUseId === toolUseId)),
            newMessage(this.#nextId++, "interaction", {
              text: event.input ?? "",
              toolName: event.toolName,
              toolUseId,
              interaction: data,
            }),
          ];
        }
        break;
      case "interaction_resolved":
        this.#updateInteraction(event.requestId, (data) => {
          if (data.kind === "questions") return data.submitted || data.declined ? data : { ...data, submitted: true };
          return data.resolved === null ? { ...data, resolved: event.optionId ?? "" } : data;
        });
        break;
      case "closed":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.connection = "disconnected";
        this.streaming = false;
        break;
    }
  }
}

export const chatState = new ChatState();
