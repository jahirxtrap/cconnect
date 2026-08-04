import { chatList } from "$lib/data/chatList.svelte";
import {
  emptyInteraction,
  isPending,
  message as newMessage,
  type ChatMessage,
  type ConnectionState,
  type InteractionData,
  type QueuedMessage,
  type QuestionDraft,
  type Role,
  type TodoItem,
} from "$lib/data/chatModels";
import type { SessionInfo } from "$lib/data/models";
import { isVisible, parseSessionMessage, type SessionMessage } from "$lib/data/sessionMessages";
import { settings } from "$lib/data/settings.svelte";
import { backend } from "$lib/services/backend.svelte";
import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
import { ChatSocket, type ServerEvent } from "$lib/services/chatSocket";
import { sessionsApi, type RewindPoint, type RewindPreview } from "$lib/services/sessionsApi";
import { uploadAttachment } from "$lib/services/uploadApi";

const DEFAULTS = {
  permissionMode: "bypassPermissions",
  model: "opus[1m]",
  effort: "xhigh",
  account: "default",
};

const HISTORY_PAGE = 100;
const COMPACT_COMMAND = "/compact";

export interface Attachment {
  id: number;
  file: File;
  name: string;
  size: number;
  progress: number;
}

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

  queue = $state<QueuedMessage[]>([]);
  attachments = $state<Attachment[]>([]);
  uploading = $state(false);
  oldestLoadedIndex = $state<number | null>(null);
  transcriptLoading = $state(false);
  transcriptExhausted = $state(false);

  rewindPoints = $state<RewindPoint[]>([]);
  rewindLoading = $state(false);
  rewindTarget = $state<RewindPoint | null>(null);
  rewindPreview = $state<RewindPreview | null>(null);
  rewindBusy = $state(false);
  pendingInput = $state<string | null>(null);

  readonly historySessions = $derived(chatList.sessionsOf(this.historyProjectKey));
  readonly connected = $derived(this.connection === "connected");
  readonly visibleQueue = $derived(this.queue.filter((item) => !this.#silent.has(item.id)));

  #socket = new ChatSocket((side, parent, event) => this.#onEvent(side, parent, event));
  #nextId = 1;
  #assistantId: number | null = null;
  #thinkingId: number | null = null;
  #outgoing = 0;
  #attachmentId = 0;
  #sent = new Set<string>();
  #silent = new Set<string>();
  #optimisticChipId: string | null = null;
  #optimisticMessageId: number | null = null;

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

  addAttachments(files: File[]) {
    if (this.uploading) return;
    this.attachments = [
      ...this.attachments,
      ...files.map((file) => ({
        id: this.#attachmentId++,
        file,
        name: file.name,
        size: file.size,
        progress: 0,
      })),
    ];
  }

  removeAttachment(id: number) {
    if (this.uploading) return;
    this.attachments = this.attachments.filter((item) => item.id !== id);
  }

  async submit(text: string) {
    const pending = this.attachments;
    if (!text.trim() && !pending.length) return;
    let uploaded: string[] = [];
    if (pending.length) {
      this.uploading = true;
      const results = await Promise.all(
        pending.map((item) =>
          uploadAttachment(item.file, (progress) => {
            this.attachments = this.attachments.map((current) =>
              current.id === item.id ? { ...current, progress } : current,
            );
          }),
        ),
      );
      uploaded = results.filter((path): path is string => path !== null);
      this.uploading = false;
      this.attachments = [];
    }
    this.send(text, uploaded);
  }

  send(text: string, attachments: string[] = []) {
    const body = text.trim();
    if (!body && !attachments.length) return;

    if (!this.streaming) {
      this.#sent.clear();
      this.#optimisticChipId = null;
      this.#optimisticMessageId = null;
      this.queue = this.queue.filter((item) => item.uploading);
    }

    const silent = !this.streaming && !this.queue.length && !this.#sent.size;
    const id = `q${this.#outgoing++}`;
    if (silent) this.#silent.add(id);
    this.queue = [...this.queue, { id, text: body, attachments, uploading: false }];

    if (silent) {
      const compacting = body === COMPACT_COMMAND || body.startsWith(`${COMPACT_COMMAND} `);
      this.#assistantId = null;
      this.#thinkingId = null;
      this.streaming = true;
      this.compacting = compacting;
      this.streamStatus = null;
      const isCommand =
        !attachments.length &&
        (this.capabilities?.commands ?? []).some(
          (command) => body === `/${command.name}` || body.startsWith(`/${command.name} `),
        );
      if (isCommand) {
        if (!compacting) this.#append(newMessage(this.#nextId++, "user", { text: body, ephemeral: true }));
      } else {
        const messageId = this.#nextId++;
        this.#append(
          newMessage(messageId, "user", {
            text: body,
            attachments: attachments.length ? attachments.map((item) => item.replace(/^uploads\//, "")) : null,
          }),
        );
        this.#optimisticChipId = id;
        this.#optimisticMessageId = messageId;
      }
    }
    this.#pumpQueue();
  }

  removeQueued(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.#sent.delete(id);
    this.#silent.delete(id);
  }

  interrupt() {
    this.#socket.sendInterrupt();
  }

  newSession() {
    this.sessionId = null;
    this.projectKey = null;
    this.#resetTranscript();
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
    this.#resetTranscript();
    this.#socket.resetResume();
    void this.#loadTranscript(session);
    this.#startSession(session.sessionId);
  }

  loadOlder() {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    const before = this.oldestLoadedIndex;
    if (!sessionId || !project || before === null || this.transcriptLoading || this.transcriptExhausted) return;
    this.transcriptLoading = true;
    this.#socket.sendLoadHistory(sessionId, project, before, HISTORY_PAGE);
  }

  toggleQuestionOption(requestId: string, questionIndex: number, optionId: string) {
    this.#updateDraft(requestId, questionIndex, (draft, question) => {
      const selected = draft.selected.includes(optionId)
        ? draft.selected.filter((id) => id !== optionId)
        : question.multiSelect
          ? [...draft.selected, optionId]
          : [optionId];
      return { ...draft, selected };
    });
  }

  setQuestionText(requestId: string, questionIndex: number, value: string) {
    this.#updateDraft(requestId, questionIndex, (draft) => ({ ...draft, freeText: value }));
  }

  setQuestionNotes(requestId: string, questionIndex: number, value: string) {
    this.#updateDraft(requestId, questionIndex, (draft) => ({ ...draft, notes: value }));
  }

  setActiveQuestion(requestId: string, index: number) {
    this.#updateInteraction(requestId, (data) => ({ ...data, activeQuestion: index }));
  }

  submitQuestions(requestId: string) {
    const data = this.messages.find((item) => item.interaction?.requestId === requestId)?.interaction;
    if (!data) return;
    this.#socket.sendQuestionsResponse(requestId, data.drafts);
    this.#updateInteraction(requestId, (current) => ({
      ...current,
      submitted: true,
      summary: current.drafts.map((draft, index) =>
        [
          ...draft.selected.map(
            (id) => current.questions[index]?.options.find((option) => option.id === id)?.label ?? id,
          ),
          draft.freeText,
        ]
          .filter(Boolean)
          .join(", "),
      ),
      notes: current.drafts.map((draft) => draft.notes),
    }));
  }

  declineQuestions(requestId: string) {
    this.#socket.sendQuestionsChat(requestId);
    this.#updateInteraction(requestId, (data) => ({ ...data, declined: true }));
  }

  async loadRewindPoints() {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    this.rewindLoading = true;
    this.rewindPoints = await sessionsApi.checkpoints(sessionId, project);
    this.rewindLoading = false;
  }

  async selectRewindPoint(point: RewindPoint) {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    this.rewindTarget = point;
    this.rewindPreview = null;
    const preview = await sessionsApi.rewindPreview(sessionId, project, point.id);
    if (this.rewindTarget?.id === point.id) this.rewindPreview = preview;
  }

  dismissRewind() {
    this.rewindTarget = null;
    this.rewindPreview = null;
    this.rewindPoints = [];
  }

  async rewind(mode: "both" | "conversation") {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    const point = this.rewindTarget;
    if (!sessionId || !project || !point) return;
    this.rewindBusy = true;
    const result = await sessionsApi.rewind(sessionId, project, point, mode);
    this.rewindBusy = false;
    if (!result?.canRewind) return;
    this.pendingInput = point.text;
    this.dismissRewind();
    const session = this.historySessions.find((item) => item.sessionId === sessionId);
    if (session) void this.#loadTranscript(session);
  }

  consumePendingInput(): string | null {
    const value = this.pendingInput;
    this.pendingInput = null;
    return value;
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

  toggleStreamTokens() {
    this.streamTokens = !this.streamTokens;
    this.#socket.sendSetGeneration({ partial: this.streamTokens });
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

  #projectKey(): string | null {
    if (this.projectKey) return this.projectKey;
    return this.cwd ? this.cwd.replace(/[^A-Za-z0-9]/g, "-") : null;
  }

  #resetTranscript() {
    this.messages = [];
    this.todos = [];
    this.queue = [];
    this.contextTokens = null;
    this.pendingToolIds = [];
    this.oldestLoadedIndex = null;
    this.transcriptLoading = false;
    this.transcriptExhausted = false;
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#sent.clear();
    this.#silent.clear();
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
  }

  async #loadTranscript(session: SessionInfo) {
    const project = session.projectKey;
    if (!project) return;
    const page = await sessionsApi.messages(session.sessionId, project, HISTORY_PAGE * 2);
    if (this.sessionId !== session.sessionId) return;
    const visible = page.items.filter(isVisible);
    this.messages = this.#nest(visible.map((item, index) => this.#fromSession(item, index)));
    this.#nextId = visible.length;
    this.oldestLoadedIndex = visible.length ? page.startIndex : null;
    this.transcriptExhausted = !page.hasMore;
    this.contextTokens = page.contextTokens;
  }

  #fromSession(item: SessionMessage, id: number): { message: ChatMessage; parent: string | null } {
    return {
      message: newMessage(id, item.role, {
        text: item.text,
        toolName: item.name,
        toolUseId: item.toolUseId,
        path: item.path,
        interaction: item.interaction,
        diffLines: item.diffLines,
        compact: item.compact,
        sourceIndex: item.index,
        labelOnly: item.labelOnly,
        result: item.result,
        images: item.images,
        timestamp: item.timestamp,
      }),
      parent: item.parent,
    };
  }

  #nest(flat: { message: ChatMessage; parent: string | null }[]): ChatMessage[] {
    const result: ChatMessage[] = [];
    const agentAt = new Map<string, number>();
    for (const { message: item, parent } of flat) {
      if (parent !== null) {
        const index = agentAt.get(parent);
        if (index !== undefined && (item.role === "tool" || item.role === "file_change")) {
          result[index] = { ...result[index], children: [...result[index].children, item] };
        }
        continue;
      }
      if (item.role === "agent" && item.toolUseId) agentAt.set(item.toolUseId, result.length);
      result.push(item);
    }
    return result;
  }

  #pumpQueue() {
    if (this.connection !== "connected") return;
    for (const item of this.queue) {
      if (item.uploading || this.#sent.has(item.id)) continue;
      this.#sent.add(item.id);
      this.#socket.sendPrompt(item.text, item.attachments, item.id);
    }
  }

  #updateDraft(
    requestId: string,
    questionIndex: number,
    transform: (draft: QuestionDraft, question: InteractionData["questions"][number]) => QuestionDraft,
  ) {
    this.#updateInteraction(requestId, (data) => ({
      ...data,
      drafts: data.drafts.map((draft, index) =>
        index === questionIndex ? transform(draft, data.questions[index]) : draft,
      ),
    }));
  }

  #onAgentChild(parent: string, event: ServerEvent) {
    const child =
      event.type === "tool_use"
        ? newMessage(this.#nextId++, "tool", {
            text: event.input ?? "",
            toolName: event.name,
            toolUseId: event.id,
            result: event.result,
          })
        : event.type === "file_change"
          ? newMessage(this.#nextId++, "file_change", {
              toolUseId: event.id,
              path: event.path,
              diffLines: event.diffLines,
              labelOnly: event.labelOnly,
            })
          : null;

    this.messages = this.messages.map((item) => {
      if (item.role !== "agent" || item.toolUseId !== parent) return item;
      if (event.type === "tool_result" && event.toolUseId && event.content !== null) {
        return {
          ...item,
          children: item.children.map((kid) =>
            kid.toolUseId === event.toolUseId ? { ...kid, result: event.content } : kid,
          ),
        };
      }
      return child ? { ...item, children: [...item.children, child] } : item;
    });

    if (event.type === "tool_result" && event.toolUseId) {
      const toolUseId = event.toolUseId;
      this.pendingToolIds = this.pendingToolIds.filter((id) => id !== toolUseId);
    }
  }

  #onDequeued(ids: string[], text: string | null) {
    const body = text ?? "";
    const reconcile = this.#optimisticChipId !== null && ids.includes(this.#optimisticChipId);
    const attachments = this.queue
      .filter((item) => ids.includes(item.id))
      .flatMap((item) => item.attachments)
      .map((item) => item.replace(/^uploads\//, ""));

    if (body || attachments.length) {
      const compacting = body === COMPACT_COMMAND || body.startsWith(`${COMPACT_COMMAND} `);
      if (reconcile && this.#optimisticMessageId !== null) {
        const messageId = this.#optimisticMessageId;
        if (!compacting) {
          this.messages = this.messages.map((item) => (item.id === messageId ? { ...item, text: body } : item));
        }
      } else {
        this.#assistantId = null;
        this.#thinkingId = null;
        if (!this.streaming) {
          this.streaming = true;
          this.compacting = compacting;
          this.streamStatus = null;
        }
        if (!compacting) {
          this.#append(
            newMessage(this.#nextId++, "user", {
              text: body,
              attachments: attachments.length ? attachments : null,
            }),
          );
        }
      }
    }

    if (reconcile) {
      this.#optimisticChipId = null;
      this.#optimisticMessageId = null;
    }
    if (ids.length) {
      this.queue = this.queue.filter((item) => !ids.includes(item.id));
      ids.forEach((id) => {
        this.#sent.delete(id);
        this.#silent.delete(id);
      });
    }
  }

  #onHistoryChunk(sessionId: string, startIndex: number, items: SessionMessage[], hasMore: boolean) {
    if (sessionId !== this.sessionId) {
      this.transcriptLoading = false;
      return;
    }
    const older = items.filter(isVisible);
    const prepended = this.#nest(older.map((item, index) => this.#fromSession(item, this.#nextId + index)));
    this.#nextId += older.length;
    this.messages = [...prepended, ...this.messages];
    this.oldestLoadedIndex = startIndex;
    this.transcriptLoading = false;
    this.transcriptExhausted = !hasMore;
  }

  #upsertTodo(id: string, content: string | null, status: string | null) {
    if (!id) return;
    if (status === "deleted") {
      this.todos = this.todos.filter((todo) => todo.content !== id);
      return;
    }
    const existing = this.todos.find((todo) => todo.content === (content ?? ""));
    const merged: TodoItem = {
      content: content ?? existing?.content ?? "",
      status: status ?? existing?.status ?? "pending",
      activeForm: existing?.activeForm ?? "",
    };
    this.todos = existing ? this.todos.map((todo) => (todo === existing ? merged : todo)) : [...this.todos, merged];
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
    if (side) return;
    if (parent !== null) {
      this.#onAgentChild(parent, event);
      return;
    }
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
        this.#pumpQueue();
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
      case "task":
        this.#upsertTodo(event.id, event.content, event.status);
        break;
      case "dequeued":
        this.#onDequeued(event.ids, event.text);
        break;
      case "history_chunk":
        this.#onHistoryChunk(
          event.sessionId,
          event.startIndex,
          event.items.map(parseSessionMessage),
          event.hasMore,
        );
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
        this.#pumpQueue();
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
