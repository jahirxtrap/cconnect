import { chatListFor } from "$lib/data/chatList.svelte";
import {
  emptyInteraction,
  isPending,
  message as newMessage,
  type ChatMessage,
  type ConnectionState,
  type InteractionData,
  type InteractionOption,
  type QueuedMessage,
  type QuestionDraft,
  type Role,
  type TodoItem,
} from "$lib/data/chatModels";
import type { ProjectInfo, SessionInfo } from "$lib/data/models";
import { isVisible, parseSessionMessage, type SessionMessage } from "$lib/data/sessionMessages";
import { settings } from "$lib/data/settings.svelte";
import { t } from "$lib/i18n/index.svelte";
import { notifier } from "$lib/services/notifier.svelte";
import { backend, baseUrlOf } from "$lib/services/backend.svelte";
import { createCapabilitiesApi, type Capabilities, type CommandOption } from "$lib/services/capabilitiesApi";
import { ChatSocket, type ServerEvent } from "$lib/services/chatSocket";
import { createHttp } from "$lib/services/http";
import { createSettingsApi } from "$lib/services/settingsApi";
import { createSessionsApi, type RewindPoint, type RewindPreview } from "$lib/services/sessionsApi";
import { uploadAttachment, UPLOAD_DIR } from "$lib/services/uploadApi";

const DEFAULTS = {
  permissionMode: "bypassPermissions",
  model: "opus[1m]",
  effort: "xhigh",
  account: "default",
};

const HISTORY_PAGE = 100;
const COMPACT_COMMAND = "/compact";
const PROJECT_KEY_SEPARATOR = /[^A-Za-z0-9]/g;
const PREVIEW_LENGTH = 120;
const NOTIFICATION_BODY_LENGTH = 120;

const optionNotificationLabel = (option: InteractionOption): string | null => {
  if (option.label) return option.label;
  if (option.id === "allow") return t("PERMISSION_ALLOW");
  if (option.id === "allow_always") return t("PERMISSION_ALLOW_ALWAYS");
  if (option.id === "deny") return t("PERMISSION_DENY");
  return null;
};
const MESSAGE_TAIL_CAP = 500;
const MESSAGE_INITIAL_CAP = 100;
const MILLIS_PER_SECOND = 1000;

const projectKeyOf = (path: string) => path.replace(PROJECT_KEY_SEPARATOR, "-");

export interface Attachment {
  id: number;
  file: File;
  name: string;
  size: number;
  progress: number;
}

export interface ChatContext {
  environmentId: string | null;
  sessionId: string | null;
  projectKey: string | null;
  cwd: string;
  color?: string | null;
}

export class ChatState {
  onContextChange: (() => void) | null = null;
  tabId: string | null = null;

  connection = $state<ConnectionState>("connecting");
  messages = $state<ChatMessage[]>([]);
  streaming = $state(false);
  compacting = $state(false);
  streamStatus = $state<string | null>(null);
  todos = $state<TodoItem[]>([]);
  contextTokens = $state<number | null>(null);
  pendingToolIds = $state<string[]>([]);

  environmentId = $state<string | null>(null);
  sessionId = $state<string | null>(null);
  projectKey = $state<string | null>(null);
  sessionColor = $state<string | null>(null);
  cwd = $state("");

  permissionMode = $state(DEFAULTS.permissionMode);
  model = $state(DEFAULTS.model);
  effort = $state(DEFAULTS.effort);
  account = $state(DEFAULTS.account);
  streamTokens = $state(true);
  showWorking = $state("label");
  showThinking = $state("full");
  showToolUse = $state("label");
  showFileChange = $state("full");
  showCompact = $state("full");

  permissionOverride = $state("");
  modelOverride = $state("");
  effortOverride = $state("");
  accountOverride = $state("");
  streamingOverride = $state<boolean | null>(null);

  capabilities = $state<Capabilities | null>(null);
  capabilitiesReady = $state(false);

  historyProjectKey = $state<string | null>(null);
  draft = $state("");

  queue = $state<QueuedMessage[]>([]);
  attachments = $state<Attachment[]>([]);
  uploading = $state(false);
  oldestLoadedIndex = $state<number | null>(null);
  transcriptLoading = $state(false);
  transcriptExhausted = $state(false);
  followBottom = $state(true);

  sideMessages = $state<ChatMessage[]>([]);
  sideStreaming = $state(false);
  sideOpen = $state(false);
  sideFullscreen = $state(false);
  sideDraft = $state("");
  #sideSessionId: string | null = null;
  #sideBoundSessionId: string | null = null;
  #sideAssistantId: number | null = null;

  rewindPoints = $state<RewindPoint[]>([]);
  rewindLoading = $state(false);
  rewindTarget = $state<RewindPoint | null>(null);
  rewindPreview = $state<RewindPreview | null>(null);
  rewindBusy = $state(false);
  pendingInput = $state<string | null>(null);

  readonly environment = $derived(backend.find(this.environmentId));
  readonly list = $derived(chatListFor(this.environment));
  readonly historyLoading = $derived(this.list?.loading ?? true);
  readonly historySessions = $derived(this.list?.sessionsOf(this.historyProjectKey) ?? []);
  readonly historyProjects = $derived(this.withDefaultProject(this.list?.projects ?? []));
  readonly connected = $derived(this.connection === "connected");
  readonly visibleQueue = $derived(this.queue.filter((item) => !this.#silent.has(item.id)));

  readonly effectiveModel = $derived(this.modelOverride || this.model);
  readonly effectiveEffort = $derived(this.effortOverride || this.effort);
  readonly effectiveAccount = $derived(this.accountOverride || this.account);
  readonly effectivePermissionMode = $derived(this.permissionOverride || this.permissionMode);
  readonly effectiveStreamTokens = $derived(this.streamingOverride ?? this.streamTokens);

  #http = createHttp(() => this.environment);
  #sessions = createSessionsApi(this.#http);
  #capabilities = createCapabilitiesApi(this.#http);
  #settings = createSettingsApi(this.#http);
  #socket = new ChatSocket(
    (side, parent, event) => this.#onEvent(side, parent, event),
    () => this.environment,
  );
  #nextId = 1;
  #assistantId: number | null = null;
  #thinkingId: number | null = null;
  #outgoing = 0;
  #attachmentId = 0;
  #sent = new Set<string>();
  #silent = new Set<string>();
  #optimisticChipId: string | null = null;
  #optimisticMessageId: number | null = null;
  #interrupting = false;
  #uploadAbort: AbortController | null = null;
  #initial: SessionInfo | null = null;
  #initialConsumed = false;

  constructor(context: ChatContext) {
    this.environmentId = context.environmentId;
    this.sessionId = context.sessionId;
    this.projectKey = context.projectKey;
    this.sessionColor = context.color ?? null;
    this.cwd = context.cwd || this.environment?.directory || settings.cwd;
    this.#initial =
      context.sessionId && context.projectKey
        ? {
            sessionId: context.sessionId,
            projectKey: context.projectKey,
            path: context.cwd || null,
            lastActive: null,
            size: 0,
            preview: null,
            title: null,
            color: context.color ?? null,
          }
        : null;
    this.#loadEnvOverrides();
    this.#applyDefaultProject();
    this.#connect();
  }

  dispose() {
    this.#socket.close();
  }

  reconnect() {
    this.#socket.close();
    this.#socket.resetResume();
    this.#connect();
  }

  selectEnvironment(id: string) {
    if (id === this.environmentId) return;
    this.environmentId = id;
    backend.select(id);
    this.cwd = this.environment?.directory ?? "";
    this.onContextChange?.();
    this.#socket.close();
    this.connection = "disconnected";
    this.capabilitiesReady = false;
    this.sessionId = null;
    this.projectKey = null;
    this.sessionColor = null;
    this.streaming = false;
    this.#resetTranscript();
    this.#loadEnvOverrides();
    this.historyProjectKey = null;
    this.#applyDefaultProject();
    this.#connect();
  }

  #connect() {
    this.connection = "connecting";
    void this.#openSocket();
  }

  async #openSocket() {
    await this.refreshServerInfo();
    this.#loadEnvOverrides();
    await this.#consumeInitialSession();
    this.#socket.connect();
  }

  async #consumeInitialSession(projectKey: string | null = null) {
    if (this.#initialConsumed) return;
    const initial = this.#initial;
    if (!initial) {
      this.#initialConsumed = true;
      return;
    }
    const target = projectKey ? { ...initial, projectKey } : initial;
    this.#initialConsumed = await this.#loadSessionInto(target);
  }

  #loadEnvOverrides() {
    const profile = this.environment;
    this.accountOverride = profile?.account ?? "";
    this.modelOverride = profile?.model ?? "";
    this.effortOverride = profile?.effort ?? "";
    this.permissionOverride = profile?.permissionMode ?? "";
    this.streamingOverride = profile?.streaming ?? null;
  }

  defaultProjectKey(projects: ProjectInfo[] = this.list?.projects ?? []): string | null {
    const directory = this.environment?.directory ?? "";
    if (!directory) return null;
    const target = projectKeyOf(directory);
    return projects.find((item) => item.projectKey === target || item.path === directory)?.projectKey ?? target;
  }

  #applyDefaultProject() {
    if (this.environment?.directory) this.historyProjectKey = this.defaultProjectKey();
  }

  withDefaultProject(projects: ProjectInfo[]): ProjectInfo[] {
    const directory = this.environment?.directory ?? "";
    if (!directory) return projects;
    const target = projectKeyOf(directory);
    if (projects.some((item) => item.projectKey === target || item.path === directory)) return projects;
    return [{ projectKey: target, path: directory, name: null, sessionCount: 0, lastActive: null }, ...projects];
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

  submit(text: string) {
    const command = (this.capabilities?.commands ?? []).find((item) => `/${item.name}` === text.trim());
    if (command) this.runCommand(command);
    else void this.sendPrompt(text);
  }

  async sendPrompt(text: string) {
    const body = text.trim();
    const pending = this.attachments;
    if (!body && !pending.length) return;
    if (!pending.length) {
      this.send(body);
      return;
    }
    if (this.uploading) return;

    const abort = new AbortController();
    this.#uploadAbort = abort;
    this.uploading = true;
    const uploaded: string[] = [];

    for (const item of pending) {
      const path = await uploadAttachment(
        item.file,
        (progress) => {
          this.attachments = this.attachments.map((current) =>
            current.id === item.id ? { ...current, progress } : current,
          );
        },
        this.environment,
        `${UPLOAD_DIR}/${item.name}`,
        abort.signal,
      );
      if (path === null) {
        this.#uploadAbort = null;
        this.uploading = false;
        this.attachments = this.attachments.map((current) => ({ ...current, progress: 0 }));
        this.pendingInput = body || null;
        return;
      }
      uploaded.push(path);
    }

    this.#uploadAbort = null;
    this.uploading = false;
    this.attachments = [];
    this.send(body, uploaded);
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
      this.#capFromTail(MESSAGE_INITIAL_CAP);
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
    if (this.uploading) {
      this.#uploadAbort?.abort();
      return;
    }
    if (!this.streaming) return;
    this.#interrupting = true;
    this.streamStatus = this.streamStatus === "failed" ? "failed" : null;
    this.#socket.sendInterrupt();
  }

  openSideChat() {
    if (this.#sideBoundSessionId !== this.sessionId) {
      this.#sideBoundSessionId = this.sessionId;
      this.sideMessages = [];
      this.#sideSessionId = null;
    }
    this.sideOpen = true;
  }

  closeSideChat() {
    this.sideOpen = false;
    this.sideFullscreen = false;
  }

  setSideFullscreen(value: boolean) {
    this.sideFullscreen = value;
  }

  clearSideChat() {
    this.#sideAssistantId = null;
    this.#sideSessionId = null;
    this.#sideBoundSessionId = this.sessionId;
    this.sideMessages = [];
    this.sideOpen = true;
  }

  sendSideQuestion(text: string) {
    const body = text.trim();
    if (!body || this.sideStreaming) return;
    this.#sideAssistantId = null;
    this.sideMessages = [...this.sideMessages, newMessage(this.#nextId++, "user", { text: body })];
    this.sideStreaming = true;
    this.#socket.sendAsk(body, this.#sideSessionId);
  }

  stopSide() {
    if (this.sideStreaming) this.#socket.sendInterrupt("side");
  }

  #onSideEvent(event: ServerEvent) {
    switch (event.type) {
      case "ask_working":
        if (this.showWorking === "label") {
          this.#sideAssistantId = null;
          this.sideMessages = [...this.sideMessages, newMessage(this.#nextId++, "working")];
        }
        break;
      case "ask_text": {
        const current = this.#sideAssistantId;
        if (current === null) {
          const id = this.#nextId++;
          this.#sideAssistantId = id;
          this.sideMessages = [...this.sideMessages, newMessage(id, "assistant", { text: event.text })];
        } else {
          this.sideMessages = this.sideMessages.map((item) =>
            item.id === current ? { ...item, text: item.text + event.text } : item,
          );
        }
        break;
      }
      case "ask_session":
        this.#sideSessionId = event.sessionId;
        break;
      case "interaction_request":
        this.#sideAssistantId = null;
        if (!this.sideMessages.some((item) => item.interaction?.requestId === event.requestId)) {
          this.sideMessages = [
            ...this.sideMessages.filter(
              (item) => !(item.role === "tool" && item.toolUseId === event.toolUseId),
            ),
            newMessage(this.#nextId++, "interaction", {
              text: event.input ?? "",
              toolName: event.toolName,
              toolUseId: event.toolUseId,
              interaction: {
                ...emptyInteraction(event.requestId, event.kind),
                options: event.options,
                title: event.title,
                questions: event.questions,
                drafts: event.questions.map(() => ({ selected: [], freeText: "", notes: "" })),
              },
            }),
          ];
        }
        break;
      case "interrupted":
        this.#sideAssistantId = null;
        this.sideStreaming = false;
        this.sideMessages = [
          ...this.sideMessages.filter(
            (item) => !(item.role === "interaction" && item.interaction && isPending(item.interaction)),
          ),
          newMessage(this.#nextId++, "interrupted"),
        ];
        break;
      case "done":
      case "error":
        this.#sideAssistantId = null;
        this.sideStreaming = false;
        break;
    }
  }

  newSession() {
    this.sessionId = null;
    this.projectKey = null;
    this.sessionColor = null;
    this.#resetTranscript();
    this.streaming = false;
    this.#socket.resetResume();
    this.#startSession(null);
  }

  openSession(session: SessionInfo) {
    void this.#openSession(session);
  }

  async #openSession(session: SessionInfo) {
    if (!(await this.#loadSessionInto(session))) return;
    this.#socket.resetResume();
    this.#startSession(session.sessionId);
  }

  restoreSession(sessionId: string, projectKey: string) {
    if (this.sessionId === sessionId) return;
    const known = this.list?.sessions.find((item) => item.sessionId === sessionId);
    this.openSession(
      known ?? {
        sessionId,
        projectKey,
        path: null,
        lastActive: null,
        size: 0,
        preview: null,
        title: null,
        color: null,
      },
    );
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
    this.#updateInteraction(requestId, (data) => {
      if (data.submitted || !data.questions[questionIndex] || !data.drafts[questionIndex]) return data;
      const multi = data.questions[questionIndex].multiSelect;
      const draft = data.drafts[questionIndex];
      const selected = multi
        ? draft.selected.includes(optionId)
          ? draft.selected.filter((id) => id !== optionId)
          : [...draft.selected, optionId]
        : draft.selected.includes(optionId)
          ? []
          : [optionId];
      const freeText = !multi && selected.length ? "" : draft.freeText;
      return {
        ...data,
        drafts: data.drafts.map((item, index) => (index === questionIndex ? { ...draft, selected, freeText } : item)),
      };
    });
  }

  setQuestionText(requestId: string, questionIndex: number, value: string) {
    this.#editDraft(requestId, questionIndex, (draft, question) => ({
      ...draft,
      freeText: value,
      selected: question && !question.multiSelect && value.trim() ? [] : draft.selected,
    }));
  }

  setQuestionNotes(requestId: string, questionIndex: number, value: string) {
    this.#editDraft(requestId, questionIndex, (draft) => ({ ...draft, notes: value }));
  }

  setActiveQuestion(requestId: string, index: number) {
    this.#updateInteraction(requestId, (data) =>
      data.submitted || data.activeQuestion === index ? data : { ...data, activeQuestion: index },
    );
  }

  submitQuestions(requestId: string) {
    const data = this.#findInteraction(requestId);
    if (!data || data.submitted) return;
    const drafts = data.drafts.map((draft) => ({
      ...draft,
      freeText: draft.freeText.trim(),
      notes: draft.notes.trim(),
    }));
    this.#socket.sendQuestionsResponse(requestId, drafts);
    const summary = data.questions.map((question, index) => {
      const draft = drafts[index] ?? { selected: [], freeText: "", notes: "" };
      const labels = question.options
        .filter((option) => draft.selected.includes(option.id))
        .map((option) => option.label)
        .filter((label): label is string => !!label);
      return [...labels, ...(draft.freeText ? [draft.freeText] : [])].join(", ");
    });
    const notes = data.questions.map((_question, index) => drafts[index]?.notes ?? "");
    this.#updateInteraction(requestId, (current) => ({ ...current, submitted: true, summary, notes }));
  }

  declineQuestions(requestId: string) {
    const data = this.#findInteraction(requestId);
    if (!data || data.submitted) return;
    this.#socket.sendQuestionsChat(requestId);
    this.#updateInteraction(requestId, (current) => ({ ...current, submitted: true, declined: true }));
  }

  async loadRewindPoints() {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    this.rewindLoading = true;
    this.rewindPoints = await this.#sessions.checkpoints(sessionId, project);
    this.rewindLoading = false;
  }

  async selectRewindPoint(point: RewindPoint) {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    this.rewindTarget = point;
    this.rewindPreview = null;
    const preview = await this.#sessions.rewindPreview(sessionId, project, point.id);
    if (this.rewindTarget?.id === point.id) this.rewindPreview = preview;
  }

  clearRewindTarget() {
    this.rewindTarget = null;
    this.rewindPreview = null;
  }

  dismissRewind() {
    this.clearRewindTarget();
    this.rewindPoints = [];
  }

  async rewind(mode: "both" | "conversation"): Promise<boolean> {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    const point = this.rewindTarget;
    if (!sessionId || !project || !point || this.rewindBusy) return false;
    this.rewindBusy = true;
    const result = await this.#sessions.rewind(sessionId, project, point, mode);
    if (!result) {
      this.rewindBusy = false;
      return false;
    }
    await this.#reloadConversation();
    this.rewindTarget = null;
    this.rewindPreview = null;
    this.rewindBusy = false;
    this.pendingInput = point.text;
    return true;
  }

  consumePendingInput(): string | null {
    const value = this.pendingInput;
    this.pendingInput = null;
    return value;
  }

  selectHistoryProject(projectKey: string | null) {
    this.historyProjectKey = projectKey;
    if (!projectKey) return;
    const path = this.historyProjects.find((item) => item.projectKey === projectKey)?.path;
    if (!path || path === this.cwd) return;
    this.cwd = path;
    this.onContextChange?.();
    if (!this.sessionId) this.#pushGeneration({ cwd: path });
  }

  answerInteraction(requestId: string, optionId: string) {
    this.#socket.sendInteractionResponse(requestId, optionId, null);
    this.#updateInteraction(requestId, (data) => (data.resolved === null ? { ...data, resolved: optionId } : data));
  }

  #dropStaleOverrides(capabilities: Capabilities) {
    const stale = {
      account: !!this.accountOverride && !capabilities.accounts.some((item) => item.id === this.accountOverride),
      model: !!this.modelOverride && !capabilities.models.some((item) => item.id === this.modelOverride),
      effort: !!this.effortOverride && !capabilities.effortLevels.includes(this.effortOverride),
      permissionMode:
        !!this.permissionOverride &&
        !capabilities.permissionModes.some((item) => item.id === this.permissionOverride),
    };
    if (!Object.values(stale).some(Boolean)) return;
    if (stale.account) this.accountOverride = "";
    if (stale.model) this.modelOverride = "";
    if (stale.effort) this.effortOverride = "";
    if (stale.permissionMode) this.permissionOverride = "";
    this.#updateEnvironment({
      ...(stale.account ? { account: "" } : {}),
      ...(stale.model ? { model: "" } : {}),
      ...(stale.effort ? { effort: "" } : {}),
      ...(stale.permissionMode ? { permissionMode: "" } : {}),
    });
  }

  setPermissionMode(mode: string) {
    this.#updateEnvironment({ permissionMode: mode });
    this.permissionOverride = mode;
    if (this.connected) this.#socket.sendSetPermissionMode(mode || this.permissionMode);
  }

  setModel(model: string) {
    this.#updateEnvironment({ model });
    this.modelOverride = model;
    this.#pushGeneration({ model: model || this.model });
  }

  setEffort(effort: string) {
    this.#updateEnvironment({ effort });
    this.effortOverride = effort;
    this.#pushGeneration({ effort: effort || this.effort });
  }

  setAccount(account: string) {
    this.#updateEnvironment({ account });
    this.accountOverride = account;
    this.#pushGeneration({ account: account || this.account });
  }

  toggleStreamTokens() {
    const next = !this.effectiveStreamTokens;
    this.#updateEnvironment({ streaming: next });
    this.streamingOverride = next;
    this.#pushGeneration({ partial: next });
  }

  runCommand(command: CommandOption) {
    if (command.kind === "usage") {
      this.#append(newMessage(this.#nextId++, "user", { text: `/${command.name}` }));
      this.#socket.sendUsage();
      return;
    }
    if (command.kind === "client" && command.name === "clear") {
      this.clearConversation();
      return;
    }
    void this.sendPrompt(`/${command.name}`);
  }

  clearConversation() {
    if (this.streaming) return;
    const sessionId = this.sessionId;
    const project = this.projectKey;
    if (sessionId && project) {
      void this.#sessions.remove(sessionId, project);
      this.list?.removeSession(sessionId);
    }
    this.newSession();
  }

  async autoRename(session: SessionInfo) {
    if (!session.projectKey) return;
    const title = await this.#sessions.autoRename(session.sessionId, session.projectKey);
    if (title) this.#updateHistoryTitle(session.sessionId, title);
  }

  async rename(session: SessionInfo, title: string) {
    const clean = title.trim();
    if (!session.projectKey || !clean) return;
    if (await this.#sessions.rename(session.sessionId, session.projectKey, clean)) {
      this.#updateHistoryTitle(session.sessionId, clean);
    }
  }

  async setColor(session: SessionInfo, color: string | null) {
    if (!session.projectKey) return;
    if (!(await this.#sessions.setColor(session.sessionId, session.projectKey, color ?? ""))) return;
    const known = this.list?.sessions.find((item) => item.sessionId === session.sessionId);
    if (known) this.list?.upsertSession({ ...known, color });
    if (this.sessionId === session.sessionId) this.sessionColor = color;
  }

  async remove(session: SessionInfo) {
    if (!session.projectKey) return;
    if (!(await this.#sessions.remove(session.sessionId, session.projectKey))) return;
    this.list?.removeSession(session.sessionId);
    if (this.sessionId === session.sessionId) this.newSession();
  }

  #updateHistoryTitle(sessionId: string, title: string) {
    const known = this.list?.sessions.find((item) => item.sessionId === sessionId);
    if (known) this.list?.upsertSession({ ...known, title });
  }

  #updateEnvironment(patch: Parameters<typeof backend.update>[1]) {
    backend.update(this.environmentId ?? this.environment?.id ?? null, patch);
  }

  #pushGeneration(patch: Parameters<ChatSocket["sendSetGeneration"]>[0]) {
    if (this.connected) this.#socket.sendSetGeneration(patch);
  }

  async refreshServerInfo() {
    const capabilities = await this.#capabilities.capabilities();
    if (capabilities) {
      this.capabilities = capabilities;
      this.#dropStaleOverrides(capabilities);
      this.account = capabilities.defaults.account || this.account;
      this.permissionMode = capabilities.defaults.permissionMode || this.permissionMode;
      this.model = capabilities.defaults.model || this.model;
      this.effort = capabilities.defaults.effort || this.effort;
    }
    const snapshot = await this.#settings.get();
    if (snapshot) {
      this.model = snapshot.model;
      this.effort = snapshot.effort;
      this.permissionMode = snapshot.permissionMode;
      this.streamTokens = snapshot.streaming;
      this.showWorking = snapshot.showWorking;
      this.showThinking = snapshot.showThinking;
      this.showToolUse = snapshot.showToolUse;
      this.showFileChange = snapshot.showFileChange;
      this.showCompact = snapshot.showCompact;
    }
    this.capabilitiesReady = true;
  }

  #startSession(resume: string | null) {
    this.#socket.sendStart({
      cwd: this.cwd,
      permissionMode: this.effectivePermissionMode,
      resume,
      model: this.effectiveModel,
      effort: this.effectiveEffort,
      partial: this.effectiveStreamTokens,
      account: this.effectiveAccount,
    });
  }

  #append(item: ChatMessage) {
    this.messages = [...this.messages, item];
    this.#capFromTail(MESSAGE_TAIL_CAP);
  }

  #capFromTail(cap: number) {
    if (!this.followBottom || this.messages.length <= cap) return;
    const kept = this.messages.slice(this.messages.length - cap);
    const cursor = kept.find((item) => item.sourceIndex >= 0)?.sourceIndex;
    this.messages = kept;
    this.oldestLoadedIndex = cursor ?? this.oldestLoadedIndex;
    this.transcriptExhausted = false;
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
    this.#interrupting = false;
  }

  async #loadSessionInto(session: SessionInfo): Promise<boolean> {
    const project = session.projectKey;
    if (!project) return false;
    const page = await this.#sessions.messages(session.sessionId, project, HISTORY_PAGE);
    if (!page) return false;
    const visible = page.items.filter(isVisible);
    const loaded = this.#nest(
      visible.map((item, index) => this.#fromSession(item, index, session.sessionId, project)),
    );
    this.#nextId = visible.length;
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
    this.#sent.clear();
    this.#silent.clear();
    this.#interrupting = false;
    if (session.path && session.path !== this.cwd) {
      this.cwd = session.path;
      this.onContextChange?.();
    }
    this.messages = loaded;
    this.sessionId = session.sessionId;
    this.projectKey = project;
    this.sessionColor = session.color;
    this.todos = [];
    this.streaming = false;
    this.queue = [];
    this.oldestLoadedIndex = page.items.length ? page.startIndex : null;
    this.transcriptLoading = false;
    this.transcriptExhausted = !page.hasMore;
    this.pendingToolIds = [];
    this.contextTokens = page.contextTokens;
    return true;
  }

  async #reloadConversation() {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    const page = await this.#sessions.messages(sessionId, project, HISTORY_PAGE);
    if (!page) return;
    const visible = page.items.filter(isVisible);
    const loaded = this.#nest(visible.map((item, index) => this.#fromSession(item, index, sessionId, project)));
    this.#nextId = visible.length;
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
    this.#sent.clear();
    this.#silent.clear();
    this.#interrupting = false;
    this.messages = loaded;
    this.todos = [];
    this.queue = [];
    this.oldestLoadedIndex = page.items.length ? page.startIndex : null;
    this.transcriptLoading = false;
    this.transcriptExhausted = !page.hasMore;
    this.pendingToolIds = [];
  }

  #imageUrls(item: SessionMessage, sessionId: string, projectKey: string | null): string[] | null {
    if (!item.images?.length) return null;
    const base = baseUrlOf(this.environment);
    const project = encodeURIComponent(projectKey ?? "");
    return item.images.map((ref) => `${base}/sessions/${sessionId}/images/${ref}?project=${project}`);
  }

  #fromSession(
    item: SessionMessage,
    id: number,
    sessionId: string,
    projectKey: string | null,
  ): { message: ChatMessage; parent: string | null } {
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
        images: this.#imageUrls(item, sessionId, projectKey),
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
      if (this.#socket.sendPrompt(item.text, item.attachments, item.id)) this.#sent.add(item.id);
    }
  }

  #editDraft(
    requestId: string,
    questionIndex: number,
    transform: (draft: QuestionDraft, question: InteractionData["questions"][number] | undefined) => QuestionDraft,
  ) {
    this.#updateInteraction(requestId, (data) => {
      if (data.submitted || !data.drafts[questionIndex]) return data;
      return {
        ...data,
        drafts: data.drafts.map((draft, index) =>
          index === questionIndex ? transform(draft, data.questions[index]) : draft,
        ),
      };
    });
  }

  #findInteraction(requestId: string): InteractionData | null {
    return (
      [...this.messages, ...this.sideMessages].find((item) => item.interaction?.requestId === requestId)
        ?.interaction ?? null
    );
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
    const attachments = [
      ...new Set(
        this.queue
          .filter((item) => ids.includes(item.id))
          .flatMap((item) => item.attachments)
          .map((item) => item.replace(/^uploads\//, "")),
      ),
    ];

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
          this.#capFromTail(MESSAGE_INITIAL_CAP);
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
    const prepended = this.#nest(
      older.map((item, index) => this.#fromSession(item, this.#nextId + index, sessionId, this.projectKey)),
    );
    this.#nextId += older.length;
    this.messages = [...prepended, ...this.messages];
    this.oldestLoadedIndex = startIndex;
    this.transcriptLoading = false;
    this.transcriptExhausted = !hasMore;
  }

  #upsertTodo(id: string, content: string | null, status: string | null) {
    if (!id) return;
    if (status === "deleted") {
      this.todos = this.todos.filter((todo) => todo.id !== id);
      return;
    }
    const existing = this.todos.find((todo) => todo.id === id);
    const merged: TodoItem = {
      id,
      content: content ?? existing?.content ?? "",
      status: status ?? existing?.status ?? "pending",
      activeForm: "",
    };
    this.todos = existing ? this.todos.map((todo) => (todo.id === id ? merged : todo)) : [...this.todos, merged];
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
    const apply = (items: ChatMessage[]) =>
      items.map((item) =>
        item.interaction?.requestId === requestId ? { ...item, interaction: transform(item.interaction) } : item,
      );
    this.messages = apply(this.messages);
    this.sideMessages = apply(this.sideMessages);
  }

  #notificationBody(
    question: boolean,
    firstQuestion: string | null | undefined,
    toolName: string | null,
    input: string | null,
  ): string | null {
    if (question) return firstQuestion?.slice(0, NOTIFICATION_BODY_LENGTH) ?? null;
    if (toolName !== "ExitPlanMode") return toolName?.slice(0, NOTIFICATION_BODY_LENGTH) ?? null;
    const heading = (input ?? "")
      .split("\n")
      .find((line) => line.trim())
      ?.replace(/^[#\s]+/, "")
      .trim()
      .slice(0, NOTIFICATION_BODY_LENGTH);
    return heading || t("PLAN");
  }

  #resetStreaming() {
    this.streaming = false;
    this.compacting = false;
    this.streamStatus = this.streamStatus === "failed" ? "failed" : null;
    this.pendingToolIds = [];
    this.#assistantId = null;
    this.#thinkingId = null;
  }

  #onEvent(side: boolean, parent: string | null, event: ServerEvent) {
    if (side) {
      this.#onSideEvent(event);
      return;
    }
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
        void this.#consumeInitialSession(event.project);
        this.connection = "connected";
        this.sessionId = event.sessionId ?? this.sessionId;
        this.projectKey = event.project ?? this.projectKey;
        this.streaming = event.running;
        const kept = this.messages.filter((item) => !item.ephemeral);
        const committed = event.committedCount;
        if (!event.resumed || !event.running) {
          this.messages = kept;
        } else if (committed !== null) {
          this.messages = kept.filter((item) => item.sourceIndex >= 0 && item.sourceIndex < committed);
        } else {
          const lastUser = kept.findLastIndex((item) => item.role === "user");
          this.messages = lastUser >= 0 ? kept.slice(0, lastUser + 1) : kept;
        }
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
        if (!(this.#interrupting && event.kind === "slow")) {
          this.streamStatus = event.kind === "ok" ? null : event.kind;
        }
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
      case "result": {
        this.#assistantId = null;
        this.#thinkingId = null;
        const sessionId = event.sessionId ?? this.sessionId;
        const list = this.list;
        if (sessionId && list && !list.sessions.some((item) => item.sessionId === sessionId)) {
          list.upsertSession({
            sessionId,
            projectKey: this.projectKey,
            path: this.cwd,
            lastActive: Date.now() / MILLIS_PER_SECOND,
            size: 0,
            preview: this.messages.find((item) => item.role === "user")?.text.slice(0, PREVIEW_LENGTH) ?? null,
            title: null,
            color: this.sessionColor,
          });
        }
        this.sessionId = sessionId;
        if (this.#sideBoundSessionId === null) this.#sideBoundSessionId = sessionId;
        this.contextTokens = event.contextTokens ?? this.contextTokens;
        break;
      }
      case "done":
        if (this.streaming && settings.notifyTaskDone) {
          void notifier.notify(
            t("NOTIF_TASK_DONE"),
            this.messages
              .filter((item) => item.role === "assistant")
              .at(-1)
              ?.text.split("\n")
              .find((line) => line.trim())
              ?.slice(0, NOTIFICATION_BODY_LENGTH) ?? null,
            this.tabId,
          );
        }
        this.#resetStreaming();
        this.#interrupting = false;
        this.#pumpQueue();
        break;
      case "interrupted":
        this.#interrupting = false;
        this.#assistantId = null;
        this.#thinkingId = null;
        this.messages = this.messages.filter(
          (item) => !(item.role === "interaction" && item.interaction && isPending(item.interaction)),
        );
        this.#append(newMessage(this.#nextId++, "interrupted"));
        this.streaming = this.queue.length > 0;
        this.compacting = false;
        this.pendingToolIds = [];
        this.streamStatus = this.streamStatus === "failed" ? "failed" : null;
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
          if (settings.notifyInteraction) {
            const question = event.kind === "questions";
            void notifier.notify(
              t(question ? "NOTIF_QUESTION" : "NOTIF_PERMISSION"),
              this.#notificationBody(question, event.questions[0]?.question, event.toolName, event.input),
              this.tabId,
              event.options
                .map((option) => {
                  const label = optionNotificationLabel(option);
                  return label === null ? null : { label, requestId: event.requestId, optionId: option.id };
                })
                .filter((action) => action !== null),
            );
          }
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
        this.#sideAssistantId = null;
        this.connection = "disconnected";
        this.streaming = false;
        this.sideStreaming = false;
        break;
    }
  }
}

