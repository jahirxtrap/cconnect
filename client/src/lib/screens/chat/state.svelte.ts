import { tick } from "svelte";
import type { ApiRetry } from "$lib/data/apiRetry";
import { chatListFor } from "$lib/data/chatList.svelte";
import { serverStatus } from "$lib/data/serverStatus.svelte";
import {
  componentValues,
  emptyInteraction,
  isPending,
  message as newMessage,
  VALUE_SEPARATOR,
  type ChatMessage,
  type ComponentElement,
  type ComponentType,
  type ConnectionState,
  type InteractionData,
  type InteractionOption,
  type QueuedMessage,
  type Role,
  type TodoItem,
  type BackgroundTask,
} from "$lib/data/chatModels";
import { agentStopText, type AgentState } from "$lib/data/agentModels";
import { emptyModState, type ModState } from "$lib/data/modModels";
import { isBusyActivity, projectKeyOf, type ChatCategory, type ProjectInfo, type SessionInfo } from "$lib/data/models";
import type { PromptCache } from "$lib/data/promptCache";
import { liveLimits } from "$lib/data/liveLimits.svelte";
import { isVisible, parseSessionMessage, type SessionMessage } from "$lib/data/sessionMessages";
import { withElements, type PickedElement } from "$lib/data/pickedElements";
import { reloadText } from "$lib/data/reload";
import { settings } from "$lib/data/settings.svelte";
import { terminalTabs } from "$lib/data/terminalTabs.svelte";

const PREFILLED_TYPES = new Set<ComponentType>(["input", "notes", "path", "file", "color"]);

const componentDefaults = (blocks: ComponentElement[]): Record<string, string> =>
  Object.fromEntries(
    blocks.flatMap((element): [string, string][] => {
      if (element.type === "page" || element.type === "group") {
        return Object.entries(componentDefaults(element.blocks));
      }
      if (!element.id) return [];
      if (element.type === "toggle") return [[element.id, String(element.checked)]];
      if (element.type === "slider") return [[element.id, element.value ?? String(element.min ?? 0)]];
      if (PREFILLED_TYPES.has(element.type)) return [[element.id, element.value ?? ""]];
      return [];
    }),
  );

interface Effective {
  simple: boolean;
  tokens: boolean;
  timings: boolean;
  thinking: string;
  tool_use: string;
  file_change: string;
  compact: string;
  working: string;
}

interface HeldView {
  queue: QueuedMessage[];
  contextTokens: number | null;
  promptCache: PromptCache | null;
  requestBytes: number | null;
  mediaBytes: number | null;
  backgroundTasks: BackgroundTask[];
  todos: TodoItem[];
  runningToolIds: string[];
}

interface SideChat {
  messages: ChatMessage[];
  sessionId: string | null;
  streaming: boolean;
}
import { t } from "$lib/i18n/index.svelte";
import { notifier } from "$lib/services/notifier.svelte";
import { agents } from "$lib/services/agents.svelte";
import { backend, baseUrlOf } from "$lib/services/backend.svelte";
import {
  commandFor,
  createCapabilitiesApi,
  effortLevelsFor,
  type Capabilities,
  type CommandOption,
} from "$lib/services/capabilitiesApi";
import { ChatSocket, type ServerEvent } from "$lib/services/chatSocket";
import { createClaudeApi } from "$lib/services/claudeApi";
import { createSharedApi } from "$lib/services/sharedApi";
import { createHttp } from "$lib/services/http";
import { createSettingsApi } from "$lib/services/settingsApi";
import { listTerminals } from "$lib/services/terminalApi";
import {
  createSessionsApi,
  type RewindPoint,
  type RewindPreview,
  type TrashedSession,
} from "$lib/services/sessionsApi";
import type { SharedFile } from "$lib/app/dragPayload.svelte";
import { uploadAttachment, UPLOAD_DIR } from "$lib/services/uploadApi";
import { ModSurface } from "$lib/screens/mods/modSurface.svelte";

const DEFAULTS = {
  permissionMode: "bypassPermissions",
  model: "opus[1m]",
  effort: "xhigh",
  account: "default",
};

const HISTORY_PAGE = 100;
const COMPACT_COMMAND = "/compact";

const withoutLiveCompact = (items: ChatMessage[]) =>
  items.filter((item) => !(item.role === "compact" && item.sourceIndex < 0));

const matchKey = (item: ChatMessage): string | null => {
  if (item.toolUseId) return `${item.role}:${item.toolUseId}`;
  const text = item.text.trim();
  return text ? `${item.role}:${text}` : null;
};
const AGENT_CHILD_ROLES: Role[] = ["thinking", "assistant", "tool", "file_change"];

const PREVIEW_LENGTH = 120;
const NOTIFICATION_BODY_LENGTH = 120;

const optionNotificationLabel = (option: InteractionOption): string | null => {
  if (option.label) return option.label;
  if (option.id === "allow") return t("PERMISSION_ALLOW");
  if (option.id === "allow_always") return t("PERMISSION_ALLOW_ALWAYS");
  if (option.id === "deny") return t("PERMISSION_DENY");
  if (option.id === "enable") return t("MOD_HOT_RELOAD_ENABLE");
  if (option.id === "decline") return t("MOD_HOT_RELOAD_DECLINE");
  return null;
};
const MESSAGE_TAIL_CAP = 500;
const MESSAGE_INITIAL_CAP = 100;
const HISTORY_LIMIT = 100;
const MILLIS_PER_SECOND = 1000;


interface AttachmentBase {
  id: number;
  name: string;
  size: number;
  progress: number;
}

export type Attachment =
  | (AttachmentBase & { file: File; path?: undefined })
  | (AttachmentBase & { path: string; file?: undefined });

export type ComposerElement = PickedElement & { id: number };

export interface ChatOverrides {
  model: string;
  effort: string;
  account: string;
  permissionMode: string;
  streaming: boolean | null;
}

export interface ChatContext {
  environmentId: string | null;
  sessionId: string | null;
  projectKey: string | null;
  cwd: string;
  color?: string | null;
  overrides?: ChatOverrides;
  agent?: string | null;
}

export class ChatState {
  onContextChange: (() => void) | null = null;
  onOverrides: ((patch: Partial<ChatOverrides>) => void) | null = null;
  tabId: string | null = null;
  readonly agent: string | null;

  connection = $state<ConnectionState>("connecting");
  agentState = $state<AgentState | null>(null);
  agentStarted = $state(false);
  contextWindow = $state<number | null>(null);
  messages = $state<ChatMessage[]>([]);
  streaming = $state(false);
  compacting = $state(false);
  streamStatus = $state<string | null>(null);
  apiRetry = $state<ApiRetry | null>(null);
  activity = $state<string | null>(null);
  resident = $state(false);
  todos = $state<TodoItem[]>([]);
  contextTokens = $state<number | null>(null);
  promptCache = $state<PromptCache | null>(null);
  compactWindow = $state<number | null>(null);
  requestBytes = $state<number | null>(null);
  mediaBytes = $state<number | null>(null);
  pendingToolIds = $state<string[]>([]);
  backgroundTasks = $state<BackgroundTask[]>([]);
  readonly backgroundToolIds = $derived(this.backgroundTasks.map((task) => task.id));
  readonly runningToolIds = $derived([...this.pendingToolIds, ...this.backgroundToolIds]);

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
  serverVisibility = $state<Effective>({
    simple: false,
    tokens: false,
    timings: false,
    thinking: "full",
    tool_use: "label",
    file_change: "full",
    compact: "full",
    working: "label",
  });

  get effectiveVisibility(): Effective {
    const local = settings.visibility;
    const server = this.serverVisibility;
    const simple = local.simple ?? server.simple;
    const merged = {
      simple,
      tokens: local.tokens ?? server.tokens,
      timings: local.timings ?? server.timings,
      thinking: local.thinking ?? server.thinking,
      tool_use: local.tool_use ?? server.tool_use,
      file_change: local.file_change ?? server.file_change,
      compact: local.compact ?? server.compact,
      working: local.working ?? server.working,
    };
    return simple ? { ...merged, thinking: "off", tool_use: "off" } : merged;
  }

  get showThinking() {
    return this.effectiveVisibility.thinking;
  }

  get showToolUse() {
    return this.effectiveVisibility.tool_use;
  }

  get showFileChange() {
    return this.effectiveVisibility.file_change;
  }

  get showCompact() {
    return this.effectiveVisibility.compact;
  }

  get showWorking() {
    return this.effectiveVisibility.working;
  }


  permissionOverride = $state("");
  modelOverride = $state("");
  effortOverride = $state("");
  accountOverride = $state("");
  switchingAccount = $state(false);
  streamingOverride = $state<boolean | null>(null);

  capabilities = $state<Capabilities | null>(null);
  capabilitiesReady = $state(false);
  #serverInfoRequest = 0;

  historyProjectKey = $state<string | null>(null);
  viewOnly = $state<TrashedSession | null>(null);
  pendingCategoryId: string | null = null;
  draft = $state("");

  queue = $state<QueuedMessage[]>([]);
  #frozen = $state<(HeldView & { messages: ChatMessage[] }) | null>(null);
  attachments = $state<Attachment[]>([]);
  elements = $state<ComposerElement[]>([]);
  uploading = $state(false);
  oldestLoadedIndex = $state<number | null>(null);
  transcriptLoading = $state(false);
  transcriptPaging = $state(false);
  scrollTop = $state(0);
  expandedIds = $state<Record<number, boolean>>({});
  transcriptExhausted = $state(false);
  followBottom = $state(true);

  #sides = $state<Record<string, SideChat>>({});
  sideOpen = $state(false);
  sideFullscreen = $state(false);
  sideDraft = $state("");
  #sideAssistantId: number | null = null;

  rewindPoints = $state<RewindPoint[]>([]);
  rewindLoading = $state(false);
  rewindTarget = $state<RewindPoint | null>(null);
  rewindPreview = $state<RewindPreview | null>(null);
  rewindBusy = $state(false);
  pendingInput = $state<string | null>(null);

  readonly untouched = $derived(
    this.sessionId === null &&
      this.viewOnly === null &&
      this.messages.length === 0 &&
      this.queue.length === 0 &&
      this.attachments.length === 0 &&
      this.elements.length === 0 &&
      this.draft.trim() === "",
  );

  readonly environment = $derived(backend.find(this.environmentId));

  get agentName(): string {
    return agents.find(this.environment, this.agent)?.name ?? this.agentState?.info?.title ?? this.agent ?? "";
  }

  get agentTitle(): string | null {
    const opening = this.messages.find((item) => item.role === "user")?.text.slice(0, PREVIEW_LENGTH);
    return this.agentState?.title || opening || null;
  }
  readonly defaultCwd = $derived(this.environment?.directory ?? "");
  readonly list = $derived(chatListFor(this.environment));
  readonly listed = $derived(this.list?.sessions.find((session) => session.sessionId === this.sessionId) ?? null);
  readonly liveActivity = $derived(this.activity ?? this.listed?.activity ?? null);
  readonly listedRewind = $derived(this.list?.loading === false ? (this.listed?.rewind ?? null) : undefined);
  readonly busy = $derived(this.streaming || isBusyActivity(this.liveActivity));
  readonly historyUnavailable = $derived(this.list === null || serverStatus.unavailable);
  readonly historyLoading = $derived(
    this.list !== null && !serverStatus.unavailable && (this.list.loading || !this.list.settingsReady),
  );
  readonly chatOrder = $derived(this.list?.chatOrder ?? "auto");
  readonly defaultCategory = $derived(this.list?.defaultCategory ?? "");
  readonly trashEnabled = $derived(this.list?.trashEnabled ?? false);
  readonly historyProject = $derived(settings.lockedProject || this.historyProjectKey);
  readonly historySessions = $derived(this.list?.sessionsOf(this.historyProject) ?? []);
  readonly historyProjects = $derived.by(() => {
    const visible = this.list?.visibleProjects ?? [];
    const opened = this.historyProject;
    const kept =
      opened && !visible.some((item) => item.projectKey === opened)
        ? (this.list?.projects ?? []).filter((item) => item.projectKey === opened)
        : [];
    return this.withDefaultProject([...visible, ...kept]);
  });
  readonly historyPath = $derived(this.#projectPath(this.historyProject));

  readonly allProjects = $derived(this.withDefaultProject(this.list?.projects ?? []));
  readonly link = $derived<ConnectionState>(
    serverStatus.link === "connected" ? this.connection : serverStatus.link,
  );
  readonly connected = $derived(this.connection === "connected");
  #settling = $state<HeldView | null>(null);
  #snapshot = $derived(this.#frozen ?? this.#settling);
  readonly queueView = $derived(this.#snapshot?.queue ?? this.queue);
  readonly backgroundView = $derived(this.#snapshot?.backgroundTasks ?? this.backgroundTasks);
  readonly todosView = $derived(this.#snapshot?.todos ?? this.todos);
  readonly runningView = $derived(this.#snapshot?.runningToolIds ?? this.runningToolIds);
  readonly contextView = $derived(this.#snapshot ? this.#snapshot.contextTokens : this.contextTokens);
  readonly cacheView = $derived(this.#snapshot ? this.#snapshot.promptCache : this.promptCache);
  readonly requestView = $derived(this.#snapshot ? this.#snapshot.requestBytes : this.requestBytes);
  readonly mediaView = $derived(this.#snapshot ? this.#snapshot.mediaBytes : this.mediaBytes);
  readonly visibleQueue = $derived(this.queueView.filter((item) => !this.#silent.has(item.id)));

  readonly effectiveModel = $derived(this.modelOverride || this.model);
  readonly effectiveEffort = $derived(this.effortOverride || this.effort);
  readonly effectiveAccount = $derived(this.accountOverride || this.account);
  readonly effectivePermissionMode = $derived(this.permissionOverride || this.permissionMode);
  readonly effectiveStreamTokens = $derived(this.streamingOverride ?? this.streamTokens);

  #http = createHttp(() => this.environment);
  #sessions = createSessionsApi(this.#http);
  #capabilities = createCapabilitiesApi(this.#http);
  #settings = createSettingsApi(this.#http);
  readonly claude = createClaudeApi(this.#http, () => this.environment);
  readonly shared = createSharedApi(this.#http);
  #socket = new ChatSocket(
    (side, parent, event) => this.#onEvent(side, parent, event),
    () => this.environment,
  );
  readonly mods = new ModSurface({
    render: (site, rid) => this.#socket.sendModRender(site, rid),
    act: (action, fields, rid) => this.#socket.sendModAction(action, fields, rid),
    answer: (id, answer) => this.#socket.sendModAnswer(id, answer),
    clientModule: (plugin, rid) => this.#socket.sendModClientModule(plugin, rid),
  });
  modsState = $state<"loading" | "off" | "needs_persistent" | "ready">("loading");
  #nextId = 1;
  #assistantId: number | null = null;
  #held: ChatMessage[] = [];
  #thinkingId: number | null = null;
  #thinkingTokens: number | null = null;
  #outgoing = 0;
  #outgoingTag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  #attachmentId = 0;
  #elementId = 0;
  #sent = new Set<string>();
  #unacked = new Set<string>();
  #silent = new Set<string>();
  #optimisticChipId: string | null = null;
  #optimisticMessageId: number | null = null;
  #interrupting = false;
  #pendingTrim: ((list: ChatMessage[]) => ChatMessage[]) | null = null;
  #uploadAbort: AbortController | null = null;
  #history: string[] = [];
  #initial: SessionInfo | null = null;
  #initialConsumed = false;
  #attaching = false;
  #arrivingMods: ModState | null = null;

  constructor(context: ChatContext) {
    this.agent = context.agent ?? null;
    this.environmentId = context.environmentId;
    this.sessionId = context.sessionId;
    this.projectKey = context.projectKey;
    this.sessionColor = context.color ?? null;
    this.cwd = context.cwd || this.defaultCwd;
    this.#initial =
      context.sessionId && context.projectKey && !this.agent
        ? {
            sessionId: context.sessionId,
            projectKey: context.projectKey,
            path: context.cwd || null,
            lastActive: null,
            size: 0,
            preview: null,
            title: null,
            color: context.color ?? null,
            activity: null,
            resident: false,
            rewind: null,
          }
        : null;
    this.transcriptLoading = this.#initial !== null || (this.agent !== null && context.sessionId !== null);
    this.#loadOverrides(context.overrides);
    this.#applyDefaultProject();
    this.#connect();
  }

  dispose() {
    this.#socket.close();
    this.mods.reset();
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
    this.cwd = this.defaultCwd;
    this.onContextChange?.();
    this.#uploadAbort?.abort();
    this.#socket.close();
    this.connection = "disconnected";
    this.capabilitiesReady = false;
    this.sessionId = null;
    this.projectKey = null;
    this.sessionColor = null;
    this.streaming = false;
    this.#resetTranscript();
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

  #loadOverrides(overrides?: ChatOverrides) {
    const profile = this.environment;
    this.accountOverride = overrides?.account ?? profile?.account ?? "";
    this.modelOverride = overrides?.model ?? profile?.model ?? "";
    this.effortOverride = overrides?.effort ?? profile?.effort ?? "";
    this.permissionOverride = overrides?.permissionMode ?? profile?.permissionMode ?? "";
    this.streamingOverride = overrides?.streaming ?? profile?.streaming ?? null;
  }

  defaultProjectKey(projects: ProjectInfo[] = this.list?.projects ?? []): string | null {
    const directory = this.defaultCwd;
    if (!directory) return null;
    const target = projectKeyOf(directory);
    return projects.find((item) => item.projectKey === target || item.path === directory)?.projectKey ?? target;
  }

  #applyDefaultProject() {
    if (settings.lockedProject) this.historyProjectKey = settings.lockedProject;
    else if (this.agent) this.historyProjectKey = projectKeyOf(this.cwd);
    else if (this.defaultCwd) this.historyProjectKey = this.defaultProjectKey();
  }

  withDefaultProject(projects: ProjectInfo[]): ProjectInfo[] {
    const directory = this.defaultCwd;
    if (!directory) return projects;
    const target = projectKeyOf(directory);
    if (projects.some((item) => item.projectKey === target || item.path === directory)) return projects;
    return [
      { projectKey: target, path: directory, name: null, customName: false, sessionCount: 0, lastActive: null },
      ...projects,
    ];
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

  addSharedAttachments(files: SharedFile[]) {
    if (this.uploading) return;
    const known = new Set(this.attachments.map((item) => item.path));
    const fresh = files.filter((file) => !known.has(file.path));
    this.attachments = [
      ...this.attachments,
      ...fresh.map((file) => ({
        id: this.#attachmentId++,
        path: file.path,
        name: file.name,
        size: file.size,
        progress: 1,
      })),
    ];
  }

  get uploadDir(): string {
    return this.projectKey ? `${this.projectKey}/${UPLOAD_DIR}` : UPLOAD_DIR;
  }

  uploadComponentFile(file: File, onProgress: (value: number) => void) {
    return uploadAttachment(file, onProgress, this.environment, `${this.uploadDir}/${file.name}`);
  }

  removeAttachment(id: number) {
    if (this.uploading) return;
    this.attachments = this.attachments.filter((item) => item.id !== id);
  }

  addElement(element: PickedElement) {
    if (this.uploading) return;
    this.elements = [...this.elements, { ...element, id: this.#elementId++ }];
  }

  removeElement(id: number) {
    if (this.uploading) return;
    this.elements = this.elements.filter((item) => item.id !== id);
  }

  userHistory(): string[] {
    return this.#history;
  }

  #rememberPrompt(text: string) {
    const body = text.trim();
    if (!body || body === this.#history[this.#history.length - 1]) return;
    this.#history = [...this.#history, body].slice(-HISTORY_LIMIT);
  }

  submit(text: string) {
    if (this.agent) {
      void this.sendPrompt(text);
      return;
    }
    const command = commandFor(this.capabilities, text);
    if (command && command.kind !== "prompt") this.runCommand(command);
    else void this.sendPrompt(text);
  }

  async sendPrompt(text: string) {
    const typed = text.trim();
    const body = withElements(typed, this.elements);
    const pending = this.attachments;
    if (!body && !pending.length) return;
    if (!pending.length) {
      this.elements = [];
      this.send(body);
      return;
    }
    if (this.uploading) return;

    const channel = this.#socket.channel;
    const dir = this.uploadDir;
    const abort = new AbortController();
    this.#uploadAbort = abort;
    this.uploading = true;
    const uploaded: string[] = [];

    for (const item of pending) {
      if (item.path !== undefined) {
        uploaded.push(item.path);
        continue;
      }
      const path = await uploadAttachment(
        item.file,
        (progress) => {
          this.attachments = this.attachments.map((current) =>
            current.id === item.id ? { ...current, progress } : current,
          );
        },
        this.environment,
        `${dir}/${item.name}`,
        abort.signal,
      );
      if (path === null) {
        this.#uploadAbort = null;
        this.uploading = false;
        this.attachments = this.attachments.map((current) => ({ ...current, progress: 0 }));
        this.pendingInput = typed || null;
        return;
      }
      uploaded.push(path);
    }

    this.#uploadAbort = null;
    this.uploading = false;
    this.attachments = [];
    this.elements = [];
    if (channel !== null && channel !== this.#socket.channel) {
      this.#rememberPrompt(body);
      this.#socket.sendPrompt(body, uploaded, this.#nextOutgoingId(), channel);
      return;
    }
    this.send(body, uploaded);
  }

  #nextOutgoingId(): string {
    return `q${this.#outgoingTag}-${this.#outgoing++}`;
  }

  send(text: string, attachments: string[] = []) {
    const body = text.trim();
    if (!body && !attachments.length) return;

    if (!this.streaming) {
      this.#sent.clear();
      this.#unacked.clear();
      this.#optimisticChipId = null;
      this.#optimisticMessageId = null;
      this.queue = this.queue.filter((item) => item.uploading);
    }

    this.#rememberPrompt(body);

    const silent = !this.streaming && !this.queue.length && !this.#sent.size;
    const id = this.#nextOutgoingId();
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
      if (!compacting) {
        const messageId = this.#nextId++;
        this.#append(
          newMessage(messageId, "user", {
            text: body,
            attachments: attachments.length ? attachments : null,
          }),
        );
        this.#optimisticChipId = id;
        this.#optimisticMessageId = messageId;
      }
    }
    this.#pumpQueue();
  }

  removeQueued(id: string) {
    if (this.#sent.has(id)) this.#socket.sendUnqueue(id);
    this.queue = this.queue.filter((item) => item.id !== id);
    this.#sent.delete(id);
    this.#unacked.delete(id);
    this.#silent.delete(id);
  }

  interrupt() {
    if (this.uploading) {
      this.#uploadAbort?.abort();
      return;
    }
    if (!this.streaming) return;
    this.#interrupting = true;
    this.streamStatus = null;
    this.#socket.sendInterrupt();
  }

  stopTask(id: string) {
    this.#socket.sendStopTask(id);
  }

  get #sideKey(): string {
    return this.sessionId ?? "";
  }

  get #sideTarget(): string {
    return Object.keys(this.#sides).find((key) => this.#sides[key].streaming) ?? this.#sideKey;
  }

  get sideMessages(): ChatMessage[] {
    return this.#sides[this.#sideKey]?.messages ?? [];
  }

  get sideStreaming(): boolean {
    return this.#sides[this.#sideKey]?.streaming ?? false;
  }

  #patchSide(key: string, patch: Partial<SideChat>) {
    const current = this.#sides[key];
    if (!current) return;
    this.#sides = { ...this.#sides, [key]: { ...current, ...patch } };
  }

  #promoteSide(sessionId: string | null) {
    const pending = this.#sides[""];
    if (!sessionId || !pending) return;
    const { "": _dropped, ...rest } = this.#sides;
    this.#sides = { ...rest, [sessionId]: pending };
  }

  #dropUnborn() {
    const sessionId = this.sessionId;
    if (!sessionId || !this.list?.isLocal(sessionId)) return;
    if (this.messages.some((item) => item.role === "assistant" && item.text.trim())) return;
    this.list.removeSession(sessionId);
  }

  #bindSession(sessionId: string | null) {
    if (!sessionId) return;
    if (this.agent) {
      this.sessionId = sessionId;
      return;
    }
    const born = this.sessionId === null;
    const list = this.list;
    if (list && !list.sessions.some((item) => item.sessionId === sessionId)) {
      list.upsertSession(
        {
          sessionId,
          projectKey: this.projectKey,
          path: this.cwd,
          lastActive: Date.now() / MILLIS_PER_SECOND,
          size: 0,
          preview: this.messages.find((item) => item.role === "user")?.text.slice(0, PREVIEW_LENGTH) ?? null,
          title: null,
          color: this.sessionColor,
          activity: null,
          resident: false,
          rewind: null,
        },
        true,
      );
    }
    this.sessionId = sessionId;
    if (born) this.#claimPendingCategory(sessionId);
    this.#promoteSide(sessionId);
  }

  #claimPendingCategory(sessionId: string | null) {
    const wanted = this.pendingCategoryId || this.defaultCategory;
    this.pendingCategoryId = null;
    if (!sessionId) return;
    const owner = this.categoriesFor(projectKeyOf(this.cwd));
    const categoryId = owner.some((item) => item.id === wanted) ? wanted : null;
    void this.placeSession(sessionId, categoryId, 0);
  }

  openSideChat() {
    const key = this.#sideKey;
    if (!this.#sides[key]) this.#sides = { ...this.#sides, [key]: { messages: [], sessionId: null, streaming: false } };
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
    this.stopSide();
    this.#sideAssistantId = null;
    this.#socket.forgetSide();
    this.#sides = { ...this.#sides, [this.#sideKey]: { messages: [], sessionId: null, streaming: false } };
    this.sideOpen = true;
  }

  sendSideQuestion(text: string) {
    const body = text.trim();
    const key = this.#sideKey;
    const side = this.#sides[key] ?? { messages: [], sessionId: null, streaming: false };
    if (!body || side.streaming) return;
    this.#sideAssistantId = null;
    this.#sides = {
      ...this.#sides,
      [key]: {
        ...side,
        messages: [...side.messages, newMessage(this.#nextId++, "user", { text: body, timestamp: null })],
        streaming: true,
      },
    };
    this.#socket.sendAsk(body, side.sessionId);
  }

  stopSide() {
    if (Object.values(this.#sides).some((side) => side.streaming)) this.#socket.sendInterrupt("side");
  }

  #onSideEvent(event: ServerEvent) {
    const key = this.#sideTarget;
    const side = this.#sides[key];
    if (!side) return;
    switch (event.type) {
      case "ask_working":
        if (side.messages.at(-1)?.role !== "working") {
          this.#sideAssistantId = null;
          this.#patchSide(key, { messages: [...side.messages, newMessage(this.#nextId++, "working", { timestamp: null })] });
        }
        break;
      case "ask_text": {
        const current = this.#sideAssistantId;
        if (current === null) {
          const id = this.#nextId++;
          this.#sideAssistantId = id;
          this.#patchSide(key, { messages: [...side.messages, newMessage(id, "assistant", { text: event.text, timestamp: null })] });
        } else {
          this.#patchSide(key, {
            messages: side.messages.map((item) => (item.id === current ? { ...item, text: item.text + event.text } : item)),
          });
        }
        break;
      }
      case "ask_session":
        this.#patchSide(key, { sessionId: event.sessionId });
        break;
      case "component":
        this.#sideAssistantId = null;
        this.#patchSide(key, {
          messages: [
            ...side.messages,
            newMessage(this.#nextId++, "interaction", {
              timestamp: null,
              ephemeral: true,
              interaction: {
                ...emptyInteraction("shown", "component"),
                title: event.title,
                titleKey: event.titleKey,
                icon: event.icon,
                blocks: event.blocks,
              },
            }),
          ],
        });
        break;
      case "usage":
        this.#sideAssistantId = null;
        this.#patchSide(key, {
          messages: [
            ...side.messages,
            newMessage(this.#nextId++, "usage", { timestamp: null, ephemeral: true, usage: event.usage }),
          ],
        });
        break;
      case "interaction_request":
        this.#sideAssistantId = null;
        if (!side.messages.some((item) => item.interaction?.requestId === event.requestId)) {
          this.#patchSide(key, { messages: [
            ...side.messages.filter(
              (item) => !(item.role === "tool" && item.toolUseId === event.toolUseId),
            ),
            newMessage(this.#nextId++, "interaction", {
              text: event.input ?? "",
              timestamp: null,
              toolName: event.toolName,
              toolUseId: event.toolUseId,
              interaction: {
                ...emptyInteraction(event.requestId, event.kind),
                options: event.options,
                title: event.title,
                titleKey: event.titleKey,
                icon: event.icon,
                blocks: event.blocks,
                submitLabel: event.submitLabel,
                variant: event.variant,
                values: componentDefaults(event.blocks),
              },
            }),
          ] });
        }
        break;
      case "interrupted":
        this.#sideAssistantId = null;
        this.#patchSide(key, {
          streaming: false,
          messages: [
            ...side.messages.filter(
              (item) => !(item.role === "interaction" && item.interaction && isPending(item.interaction)),
            ),
            newMessage(this.#nextId++, "interrupted", { timestamp: null }),
          ],
        });
        break;
      case "done":
      case "error":
        this.#sideAssistantId = null;
        this.#patchSide(key, { streaming: false });
        break;
    }
  }

  newSession() {
    this.viewOnly = null;
    this.pendingCategoryId = null;
    this.sessionId = null;
    this.projectKey = null;
    this.sessionColor = null;
    this.#resetTranscript();
    this.streaming = false;
    this.compacting = false;
    this.activity = null;
    this.resident = false;
    this.streamStatus = null;
    this.#socket.resetResume();
    this.#startSession(null);
  }

  openSession(session: SessionInfo) {
    void this.#openSession(session);
  }

  startAgentSession(cwd: string) {
    this.cwd = cwd;
    this.#applyDefaultProject();
    this.newSession();
  }

  openAgentSession(sessionId: string) {
    if (sessionId === this.sessionId) return;
    this.#socket.resetResume();
    this.#resetTranscript();
    this.sessionId = sessionId;
    this.streaming = false;
    this.compacting = false;
    this.activity = null;
    this.streamStatus = null;
    this.transcriptLoading = true;
    this.#startSession(sessionId);
  }

  setAgentOption(id: string, value: string | boolean) {
    this.#socket.sendSetOption(id, value);
  }

  agentLogin(method: string) {
    this.#socket.sendAgentLogin(method);
  }

  agentLogout() {
    this.#socket.sendAgentLogout();
  }

  agentRetry() {
    this.#socket.sendAgentRetry();
  }

  get view(): ChatMessage[] {
    return this.#frozen?.messages ?? this.messages;
  }

  #heldView(): HeldView {
    return {
      queue: this.queue,
      contextTokens: this.contextTokens,
      promptCache: this.promptCache,
      requestBytes: this.requestBytes,
      mediaBytes: this.mediaBytes,
      backgroundTasks: this.backgroundTasks,
      todos: this.todos,
      runningToolIds: this.runningToolIds,
    };
  }

  #freeze() {
    if (this.#frozen === null && this.messages.length) this.#frozen = { messages: this.messages, ...this.#heldView() };
  }

  async #openSession(session: SessionInfo) {
    this.#socket.resetResume();
    this.#freeze();
    this.viewOnly = null;
    this.pendingCategoryId = null;
    if (session.sessionId !== this.sessionId) {
      this.sessionId = session.sessionId;
      this.projectKey = session.projectKey ?? this.projectKey;
      this.sessionColor = session.color;
      this.todos = [];
      this.queue = [];
      this.compacting = false;
      this.activity = null;
      this.resident = false;
      this.streamStatus = null;
      this.transcriptLoading = this.messages.length === 0;
      this.transcriptPaging = false;
    }
    if (!(await this.#loadSessionInto(session))) {
      this.#frozen = null;
      this.transcriptLoading = false;
      return;
    }
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
        activity: null,
        resident: false,
        rewind: null,
      },
    );
  }

  loadOlder() {
    const before = this.oldestLoadedIndex;
    if (before === null || this.transcriptExhausted || this.transcriptLoading || this.transcriptPaging) return;
    if (this.viewOnly) {
      void this.#loadOlderViewOnly(this.viewOnly, before);
      return;
    }
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    this.transcriptPaging = this.#socket.sendLoadHistory(sessionId, project, before, HISTORY_PAGE);
  }

  #abandonPage() {
    if (!this.viewOnly) this.transcriptPaging = false;
  }

  async #loadOlderViewOnly(item: TrashedSession, before: number) {
    this.transcriptPaging = true;
    const page = await this.#sessions.messages(
      item.sessionId,
      item.projectKey,
      HISTORY_PAGE,
      before,
      settings.visibility,
      true,
    );
    if (this.viewOnly !== item) return;
    this.transcriptPaging = false;
    if (!page) return;
    const older = page.items.filter(isVisible);
    const prepended = this.#nest(
      older.map((message, index) => this.#fromSession(message, this.#nextId + index, item.sessionId, item.projectKey)),
    );
    this.#nextId += older.length;
    this.messages = [...prepended, ...this.messages];
    this.oldestLoadedIndex = page.startIndex;
    this.transcriptExhausted = !page.hasMore;
  }

  setActivePage(requestId: string, index: number) {
    this.#updateInteraction(requestId, (data) =>
      data.submitted || data.activePage === index ? data : { ...data, activePage: index },
    );
  }

  setComponentValue(requestId: string, id: string, value: string) {
    this.#updateInteraction(requestId, (current) => ({ ...current, values: { ...current.values, [id]: value } }));
  }

  toggleComponentOption(requestId: string, id: string, value: string, multiple: boolean) {
    this.#updateInteraction(requestId, (current) => {
      const picked = (current.values[id] ?? "").split(VALUE_SEPARATOR).filter(Boolean);
      let next: string;
      if (!multiple) {
        next = picked[0] === value ? "" : value;
      } else {
        next = (picked.includes(value) ? picked.filter((item) => item !== value) : [...picked, value]).join(
          VALUE_SEPARATOR,
        );
      }
      return { ...current, values: { ...current.values, [id]: next } };
    });
  }

  submitComponent(requestId: string, action: string | null = null) {
    const data = this.#findInteraction(requestId);
    if (!data || data.submitted) return;
    const values = { ...data.values };
    const actionId = data.blocks.find((element) => element.type === "buttons")?.id;
    if (action && actionId) values[actionId] = action;
    this.#socket.sendComponentResponse(requestId, componentValues(data.blocks, values));
    this.#updateInteraction(requestId, (current) => ({ ...current, submitted: true, values }));
  }

  declineQuestions(requestId: string, dismissedBy: "button" | "close" = "close") {
    const data = this.#findInteraction(requestId);
    if (!data || data.submitted) return;
    this.#socket.sendQuestionsChat(requestId, dismissedBy);
    this.#updateInteraction(requestId, (current) => ({
      ...current,
      submitted: true,
      declined: true,
      dismissedBy,
    }));
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
    const seen = this.#rewindSeen;
    this.#rewindSeen = { sessionId, anchor: point.rewindId };
    const result = await this.#sessions.rewind(sessionId, project, point, mode);
    if (!result) {
      this.#rewindSeen = seen;
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

  #projectPath(projectKey: string | null): string | null {
    return this.historyProjects.find((item) => item.projectKey === projectKey)?.path ?? null;
  }

  selectHistoryProject(projectKey: string | null) {
    this.historyProjectKey = projectKey;
    if (!projectKey && this.sessionId) return;
    const path = projectKey ? this.#projectPath(projectKey) : this.defaultCwd;
    if (path === null || path === this.cwd) return;
    this.cwd = path;
    this.onContextChange?.();
    if (!this.sessionId) this.#pushGeneration({ cwd: path });
  }

  answerInteraction(requestId: string, optionId: string) {
    this.#socket.sendInteractionResponse(requestId, optionId, null);
    this.#updateInteraction(requestId, (data) => (data.resolved === null ? { ...data, resolved: optionId } : data));
  }

  #dropStaleOverrides(capabilities: Capabilities) {
    const staleModel = !!this.modelOverride && !capabilities.models.some((item) => item.id === this.modelOverride);
    const model = staleModel ? capabilities.defaults.model : this.modelOverride || capabilities.defaults.model;
    const stale = {
      account: !!this.accountOverride && !capabilities.accounts.some((item) => item.id === this.accountOverride),
      model: staleModel,
      effort: !!this.effortOverride && !effortLevelsFor(capabilities, model).includes(this.effortOverride),
      permissionMode:
        !!this.permissionOverride &&
        !capabilities.permissionModes.some((item) => item.id === this.permissionOverride),
    };
    if (!Object.values(stale).some(Boolean)) return;
    if (stale.account) this.accountOverride = "";
    if (stale.model) this.modelOverride = "";
    if (stale.effort) this.effortOverride = "";
    if (stale.permissionMode) this.permissionOverride = "";
    this.onOverrides?.({
      ...(stale.account ? { account: "" } : {}),
      ...(stale.model ? { model: "" } : {}),
      ...(stale.effort ? { effort: "" } : {}),
      ...(stale.permissionMode ? { permissionMode: "" } : {}),
    });
  }

  setPermissionMode(mode: string) {
    this.onOverrides?.({ permissionMode: mode });
    this.permissionOverride = mode;
    if (this.connected) this.#socket.sendSetPermissionMode(mode || this.permissionMode);
  }

  closeResident() {
    if (this.connected) this.#socket.sendCloseResident();
  }

  setModel(model: string) {
    this.onOverrides?.({ model });
    this.modelOverride = model;
    this.#pushGeneration({ model: model || this.model });
  }

  setEffort(effort: string) {
    this.onOverrides?.({ effort });
    this.effortOverride = effort;
    this.#pushGeneration({ effort: effort || this.effort });
  }

  #usesProvider(id: string) {
    return (this.capabilities?.accounts ?? []).some((item) => item.id === id && item.provider);
  }

  setAccount(account: string) {
    const previous = this.effectiveAccount;
    const next = account || this.account;
    this.#storeAccount(account);
    this.#pushGeneration({ account: next });
    this.switchingAccount = this.#usesProvider(previous) || this.#usesProvider(next);
    void this.refreshServerInfo();
  }

  #storeAccount(account: string) {
    this.onOverrides?.({ account });
    this.accountOverride = account;
  }

  setStreamTokens(value: string) {
    const next = value === "" ? null : value === "on";
    this.onOverrides?.({ streaming: next });
    this.streamingOverride = next;
    this.#pushGeneration({ partial: next ?? this.streamTokens });
  }

  runCommand(command: CommandOption) {
    if (command.kind === "usage" || command.kind === "reload") {
      this.#appendLocal(newMessage(this.#nextId++, "user", { text: `/${command.name}`, ephemeral: true }));
      if (command.kind === "usage") this.#socket.sendUsage();
      else this.#socket.sendReload(command.name);
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
    this.newSession();
    if (!sessionId || !project) return;
    void this.#sessions.remove(sessionId, project);
    this.list?.forgetSession(sessionId);
  }

  async autoRename(session: SessionInfo) {
    if (!session.projectKey) return;
    const title = await this.#sessions.autoRename(
      session.sessionId,
      session.projectKey,
      this.accountOverride || this.account,
    );
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

  readonly categories = $derived(this.list?.categories ?? []);
  readonly placement = $derived(this.list?.placement ?? {});

  readonly historyCategories = $derived.by(() => {
    const project = this.historyProject;
    if (!project) return this.categories;
    const used = new Set(this.historySessions.map((item) => this.placement[item.sessionId]?.categoryId));
    return this.categories.filter((item) => item.projectKey === project || (!item.projectKey && used.has(item.id)));
  });

  categoriesFor(projectKey: string | null): ChatCategory[] {
    return this.categories.filter((item) => !item.projectKey || item.projectKey === projectKey);
  }

  readonly scopedCategories = $derived(
    settings.lockedProject ? this.categoriesFor(settings.lockedProject) : this.categories,
  );

  async setChatOrder(order: string) {
    if (order === this.chatOrder) return;
    if (order === "manual") await this.#seedManualOrder();
    if (this.list) this.list.chatOrder = order;
    await this.#settings.update({ chat_order: order });
  }

  async #seedManualOrder() {
    const ordered = [...this.historySessions].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));
    const missing = ordered.filter((item) => !this.placement[item.sessionId]).map((item) => item.sessionId);
    if (missing.length) await this.#sessions.seedOrder(missing);
  }

  async setDefaultCategory(categoryId: string) {
    if (categoryId === this.defaultCategory) return;
    if (this.list) this.list.defaultCategory = categoryId;
    await this.#settings.update({ default_category: categoryId });
  }

  async createCategory(name: string, color: string | null = null) {
    const clean = name.trim();
    if (!clean) return;
    const created = await this.#sessions.createCategory(clean, color, this.historyProject);
    if (created) this.list?.upsertCategory(created);
  }

  async createCategoryWith(name: string, sessionId: string) {
    const clean = name.trim();
    if (!clean) return;
    const owner = this.list?.sessions.find((item) => item.sessionId === sessionId)?.projectKey ?? null;
    const created = await this.#sessions.createCategory(clean, null, owner);
    if (!created) return;
    this.list?.upsertCategory(created);
    await this.#sessions.placeSession(sessionId, created.id, 0);
  }

  async renameCategory(category: ChatCategory, name: string) {
    const clean = name.trim();
    if (!clean) return;
    const updated = await this.#sessions.updateCategory(category.id, { name: clean });
    if (updated) this.list?.upsertCategory(updated);
  }

  async setCategoryProject(category: ChatCategory, projectKey: string) {
    const updated = await this.#sessions.updateCategory(category.id, { project_key: projectKey });
    if (updated) this.list?.upsertCategory(updated);
  }

  async setCategoryColor(category: ChatCategory, color: string | null) {
    const updated = await this.#sessions.updateCategory(category.id, { color: color ?? "" });
    if (updated) this.list?.upsertCategory(updated);
  }

  isCategoryCollapsed(categoryId: string): boolean {
    return settings.collapsedCategories.includes(categoryId);
  }

  toggleCategory(category: ChatCategory) {
    const folded = settings.collapsedCategories;
    settings.collapsedCategories = folded.includes(category.id)
      ? folded.filter((id) => id !== category.id)
      : [...folded, category.id];
  }

  isCategoryHidden(categoryId: string): boolean {
    return settings.hiddenCategories.includes(categoryId);
  }

  toggleCategoryHidden(categoryId: string) {
    const hidden = settings.hiddenCategories;
    settings.hiddenCategories = hidden.includes(categoryId)
      ? hidden.filter((id) => id !== categoryId)
      : [...hidden, categoryId];
  }

  isProjectHidden(projectKey: string): boolean {
    return settings.hiddenProjects.includes(projectKey);
  }

  toggleProjectHidden(projectKey: string) {
    const hidden = settings.hiddenProjects;
    settings.hiddenProjects = hidden.includes(projectKey)
      ? hidden.filter((key) => key !== projectKey)
      : [...hidden, projectKey];
  }

  reorderCategory(categoryId: string, index: number) {
    this.list?.moveCategory(categoryId, index);
  }

  async commitCategoryOrder(categoryId: string) {
    const index = this.categories.findIndex((item) => item.id === categoryId);
    if (index < 0) return;
    const updated = await this.#sessions.updateCategory(categoryId, { index });
    if (updated) this.list?.upsertCategory(updated);
  }

  async deleteCategory(category: ChatCategory) {
    if (await this.#sessions.deleteCategory(category.id)) this.list?.removeCategory(category.id);
  }

  async placeSession(sessionId: string, categoryId: string | null, index: number | null = null) {
    await this.#sessions.placeSession(sessionId, categoryId, index);
  }

  async trash() {
    return await this.#sessions.trash();
  }

  async openTrashed(sessionId: string, projectKey: string) {
    const item = (await this.#sessions.trash()).items.find((entry) => entry.sessionId === sessionId);
    if (!item) {
      if (this.sessionId !== null || this.viewOnly) this.newSession();
      return;
    }
    await this.openViewOnly(item.projectKey ? item : { ...item, projectKey });
  }

  async openViewOnly(item: TrashedSession) {
    this.newSession();
    this.viewOnly = item;
    this.transcriptLoading = true;
    const page = await this.#sessions.messages(
      item.sessionId,
      item.projectKey,
      HISTORY_PAGE,
      null,
      settings.visibility,
      true,
    );
    if (this.viewOnly !== item) return;
    const visible = (page?.items ?? []).filter(isVisible);
    this.messages = this.#nest(
      visible.map((message, index) => this.#fromSession(message, index, item.sessionId, item.projectKey)),
    );
    this.#nextId = visible.length;
    this.expandedIds = {};
    this.oldestLoadedIndex = page && page.items.length ? page.startIndex : null;
    this.transcriptExhausted = !page?.hasMore;
    this.contextTokens = page?.contextTokens ?? null;
    this.promptCache = page?.cache ?? null;
    this.requestBytes = page?.requestBytes ?? null;
    this.mediaBytes = page?.mediaBytes ?? null;
    this.transcriptLoading = false;
  }

  closeViewOnly() {
    if (!this.viewOnly) return;
    this.viewOnly = null;
    this.newSession();
  }

  async restoreViewOnly() {
    const item = this.viewOnly;
    if (!item) return;
    await this.restoreTrashed(item.sessionId);
    this.viewOnly = null;
    this.newSession();
    this.openSession({
      sessionId: item.sessionId,
      projectKey: item.projectKey,
      path: item.path,
      lastActive: null,
      size: 0,
      preview: null,
      title: item.title,
      color: null,
      activity: null,
      resident: false,
      rewind: null,
    });
  }

  async purgeViewOnly() {
    const item = this.viewOnly;
    if (!item) return;
    await this.purgeTrashed(item.sessionId);
    this.closeViewOnly();
  }

  async restoreTrashed(sessionId: string) {
    await this.#sessions.restoreTrashed(sessionId);
  }

  async purgeTrashed(sessionId: string) {
    await this.#sessions.purgeTrashed(sessionId);
  }

  async emptyTrash() {
    await this.#sessions.emptyTrash();
  }

  async addProject(path: string, name: string | null = null) {
    const clean = path.trim();
    if (!clean) return null;
    return await this.#sessions.addProject(clean, name?.trim() || null);
  }

  async renameProject(project: ProjectInfo, name: string) {
    const clean = name.trim();
    if (clean === (project.name ?? "")) return;
    await this.#sessions.renameProject(project.projectKey, clean, project.path);
  }

  async deleteProject(projectKey: string) {
    if (!(await this.#sessions.deleteProject(projectKey))) return;
    this.list?.forgetProject(projectKey);
    if (this.historyProjectKey === projectKey) this.selectHistoryProject(null);
    if (this.projectKey === projectKey) this.newSession();
  }

  async move(session: SessionInfo, targetCwd: string): Promise<boolean> {
    const cwd = targetCwd.trim();
    if (!session.projectKey || !cwd) return false;
    const movedKey = await this.#sessions.move(session.sessionId, session.projectKey, cwd);
    if (!movedKey) return false;
    const known = this.list?.sessions.find((item) => item.sessionId === session.sessionId);
    if (known) this.list?.upsertSession({ ...known, projectKey: movedKey, path: cwd });
    if (this.sessionId === session.sessionId) {
      this.cwd = cwd;
      this.projectKey = movedKey;
    }
    return true;
  }

  async remove(session: SessionInfo) {
    if (!session.projectKey) return;
    if (!(await this.#sessions.remove(session.sessionId, session.projectKey))) return;
    this.list?.forgetSession(session.sessionId);
  }

  #updateHistoryTitle(sessionId: string, title: string) {
    const known = this.list?.sessions.find((item) => item.sessionId === sessionId);
    if (known) this.list?.upsertSession({ ...known, title });
  }

  #pushGeneration(patch: Parameters<ChatSocket["sendSetGeneration"]>[0]) {
    if (this.connected) this.#socket.sendSetGeneration(patch);
  }

  async refreshServerInfo() {
    const request = ++this.#serverInfoRequest;
    const capabilities = await this.#capabilities.capabilities(
      this.accountOverride || this.account,
    );
    if (request !== this.#serverInfoRequest) return;
    this.switchingAccount = false;
    if (capabilities) {
      this.capabilities = capabilities;
      backend.rememberScheme(this.environment, capabilities.sharedScheme);
      this.#dropStaleOverrides(capabilities);
      this.account = capabilities.defaults.account || this.account;
      this.permissionMode = capabilities.defaults.permissionMode || this.permissionMode;
      this.model = capabilities.defaults.model || this.model;
      this.effort = capabilities.defaults.effort || this.effort;
    }
    const snapshot = await this.#settings.get();
    if (request !== this.#serverInfoRequest) return;
    if (snapshot) {
      const served = (capabilities ?? this.capabilities)?.models ?? [];
      const shared = served.some((item) => item.id === snapshot.model);
      this.model = shared || !served.length ? snapshot.model : this.model;
      this.effort = snapshot.effort;
      this.permissionMode = snapshot.permissionMode;
      this.streamTokens = snapshot.streaming;
      this.compactWindow = snapshot.autoCompact ? snapshot.autoCompactWindow : null;
      this.modsState = snapshot.modSurfaces !== true ? "off" : snapshot.persistentSessions ? "ready" : "needs_persistent";
      if (snapshot.modSurfaces === false) this.mods.applyState(emptyModState());
      this.list?.applySettings(snapshot);
      this.serverVisibility = {
        simple: snapshot.simpleMode,
        tokens: snapshot.showTokens,
        timings: snapshot.showToolTime,
        thinking: snapshot.showThinking,
        tool_use: snapshot.showToolUse,
        file_change: snapshot.showFileChange,
        compact: snapshot.showCompact,
        working: snapshot.showWorking,
      };
    }
    this.capabilitiesReady = true;
  }

  #startSession(resume: string | null) {
    this.#freeze();
    if (this.#frozen === null && resume) this.transcriptLoading = true;
    this.#socket.sendStart({
      cwd: this.cwd,
      permissionMode: this.effectivePermissionMode,
      resume,
      model: this.effectiveModel,
      effort: this.effectiveEffort,
      partial: this.effectiveStreamTokens,
      account: this.effectiveAccount,
      visibility: settings.visibility,
      agent: this.agent,
    });
  }

  syncVisibility() {
    this.#socket.sendVisibility(settings.visibility);
    this.#reloadOnDone = this.streaming;
    if (this.agent && this.streaming) return;
    void this.#reloadConversation({ keepLive: this.streaming });
  }

  #append(item: ChatMessage) {
    this.messages = [...this.messages, ...this.#takeHeld(), item];
    this.#capFromTail(MESSAGE_TAIL_CAP);
  }

  #appendLocal(item: ChatMessage) {
    if (this.streaming && this.#assistantId !== null) this.#held = [...this.#held, item];
    else this.#append(item);
  }

  #takeHeld(): ChatMessage[] {
    const held = this.#held;
    this.#held = [];
    return held;
  }

  #flushHeld() {
    if (this.#held.length) this.messages = [...this.messages, ...this.#takeHeld()];
  }

  #capFromTail(cap: number) {
    if (!this.followBottom || this.messages.length <= cap) return;
    const last = this.messages.length - cap;
    const cut = this.messages.findLastIndex((item, index) => index <= last && item.sourceIndex >= 0);
    if (cut <= 0) return;
    this.messages = this.messages.slice(cut);
    this.oldestLoadedIndex = this.messages[0].sourceIndex;
    this.transcriptExhausted = false;
  }

  async #indexLive() {
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    const held = this.messages;
    const live = held.filter((item) => item.sourceIndex < 0 && !item.ephemeral).length;
    if (!sessionId || !project || !live || this.agent) return;
    const page = await this.#sessions.messages(sessionId, project, Math.min(live, MESSAGE_TAIL_CAP), null, settings.visibility);
    if (!page || sessionId !== this.sessionId) return;
    const stored = this.#nest(page.items.filter(isVisible).map((item, index) => this.#fromSession(item, index, sessionId, project)));
    const positions = new Map<string, number>();
    const repeated = new Set<string>();
    const indexed = new Map(stored.map((item, at) => [item.sourceIndex, at]));
    stored.forEach((item, at) => {
      const key = matchKey(item);
      if (key === null) return;
      if (positions.has(key)) repeated.add(key);
      positions.set(key, at);
    });
    const found = new Map<number, number>();
    let bound = stored.length;
    for (let i = held.length - 1; i >= 0; i--) {
      const item = held[i];
      if (item.sourceIndex >= 0) {
        const at = indexed.get(item.sourceIndex);
        if (at === undefined) break;
        bound = Math.min(bound, at);
        continue;
      }
      const key = item.ephemeral ? null : matchKey(item);
      const at = key === null || repeated.has(key) ? undefined : positions.get(key);
      if (at === undefined || at >= bound) continue;
      found.set(item.id, stored[at].sourceIndex);
      bound = at;
    }
    if (!found.size) return;
    this.messages = this.messages.map((item) => {
      const index = found.get(item.id);
      return index === undefined ? item : { ...item, sourceIndex: index };
    });
  }

  #projectKey(): string | null {
    if (this.projectKey) return this.projectKey;
    return this.cwd ? this.cwd.replace(/[^A-Za-z0-9]/g, "-") : null;
  }

  #resetTranscript() {
    this.messages = [];
    this.#held = [];
    this.#history = [];
    this.expandedIds = {};
    this.todos = [];
    this.queue = [];
    this.contextTokens = null;
    this.contextWindow = null;
    this.promptCache = null;
    this.requestBytes = null;
    this.mediaBytes = null;
    this.pendingToolIds = [];
    this.backgroundTasks = [];
    this.oldestLoadedIndex = null;
    this.transcriptLoading = false;
    this.transcriptPaging = false;
    this.transcriptExhausted = false;
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#sent.clear();
    this.#unacked.clear();
    this.#silent.clear();
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
    this.#interrupting = false;
    this.#pendingTrim = null;
    this.#frozen = null;
  }

  async #loadSessionInto(session: SessionInfo): Promise<boolean> {
    const project = session.projectKey;
    if (!project) return false;
    const page = await this.#sessions.messages(session.sessionId, project, HISTORY_PAGE, null, settings.visibility);
    if (!page) return false;
    const visible = page.items.filter(isVisible);
    const loaded = this.#nest(
      visible.map((item, index) => this.#fromSession(item, index, session.sessionId, project)),
    );
    this.#nextId = visible.length;
    this.expandedIds = {};
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
    this.#sent.clear();
    this.#unacked.clear();
    this.#silent.clear();
    this.#interrupting = false;
    this.#pendingTrim = null;
    if (session.path && session.path !== this.cwd) {
      this.cwd = session.path;
      this.onContextChange?.();
    }
    this.messages = loaded;
    this.sessionId = session.sessionId;
    this.projectKey = project;
    this.sessionColor = session.color;
    this.todos = [];
    this.queue = [];
    this.oldestLoadedIndex = page.items.length ? page.startIndex : null;
    this.transcriptPaging = false;
    this.transcriptExhausted = !page.hasMore;
    this.pendingToolIds = [];
    this.backgroundTasks = [];
    this.contextTokens = page.contextTokens;
    this.promptCache = page.cache;
    this.requestBytes = page.requestBytes;
    this.mediaBytes = page.mediaBytes;
    if (page.prompts) this.#history = page.prompts;
    return true;
  }

  #reloadOnDone = false;
  #cutChannel: string | null = null;
  #rewindSeen: { sessionId: string | null; anchor: string | null } | null = null;

  followRewind(sessionId: string | null, anchor: string | null | undefined) {
    if (anchor === undefined) return;
    const seen = this.#rewindSeen;
    this.#rewindSeen = { sessionId, anchor };
    if (!anchor || seen?.sessionId !== sessionId || seen.anchor === anchor) return;
    void this.#reloadConversation({ keepLive: this.streaming });
  }

  async #reloadConversation({ keepLive = false } = {}) {
    if (this.agent) {
      this.#socket.sendHistory();
      return;
    }
    const sessionId = this.sessionId;
    const project = this.#projectKey();
    if (!sessionId || !project) return;
    const page = await this.#sessions.messages(sessionId, project, HISTORY_PAGE, null, settings.visibility);
    if (!page) return;
    const carried = keepLive ? this.messages.filter((item) => item.sourceIndex < 0) : [];
    const visible = page.items.filter(isVisible);
    const loaded = this.#nest(visible.map((item, index) => this.#fromSession(item, index, sessionId, project)));
    this.#nextId = visible.length;
    this.expandedIds = {};
    if (!keepLive) {
      this.#assistantId = null;
      this.#thinkingId = null;
    }
    this.#optimisticChipId = null;
    this.#optimisticMessageId = null;
    const pending = new Set(this.queue.map((item) => item.id));
    for (const id of [...this.#sent]) if (!pending.has(id)) this.#sent.delete(id);
    for (const id of [...this.#unacked]) if (!pending.has(id)) this.#unacked.delete(id);
    this.#silent.clear();
    this.#interrupting = false;
    this.#pendingTrim = null;
    const live = loaded.some((item) => item.role === "compact") ? withoutLiveCompact(carried) : carried;
    this.messages = live.length ? [...loaded, ...live] : loaded;
    this.#nextId = Math.max(this.#nextId, ...live.map((item) => item.id + 1), 0);
    this.todos = [];
    this.oldestLoadedIndex = page.items.length ? page.startIndex : null;
    this.transcriptLoading = false;
    this.transcriptPaging = false;
    this.transcriptExhausted = !page.hasMore;
    this.pendingToolIds = [];
    this.backgroundTasks = [];
    if (page.prompts) this.#history = page.prompts;
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
        toolMcp: item.mcp,
        toolUseId: item.toolUseId,
        path: item.path,
        interaction: item.interaction,
        diffLines: item.diffLines,
        files: item.files,
        compact: item.compact,
        agentRun: item.agentRun,
        agentResult: item.agentResult,
        thinkingTokens: item.thinkingTokens,
        toolMs: item.toolMs,
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
        if (index !== undefined && AGENT_CHILD_ROLES.includes(item.role)) {
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
      if (this.#socket.sendPrompt(item.text, item.attachments, item.id)) {
        this.#sent.add(item.id);
        this.#unacked.add(item.id);
      }
    }
  }

  #applyQueueSnapshot(items: QueuedMessage[]) {
    for (const item of items) this.#unacked.delete(item.id);
    const local = this.queue.filter((item) => item.uploading || this.#unacked.has(item.id));
    this.queue = [...items, ...local];
    this.#sent.clear();
    for (const item of items) this.#sent.add(item.id);
    for (const id of this.#unacked) this.#sent.add(id);
  }

  #findInteraction(requestId: string): InteractionData | null {
    return (
      [...this.messages, ...this.sideMessages].find((item) => item.interaction?.requestId === requestId)
        ?.interaction ?? null
    );
  }

  #childrenAfter(children: ChatMessage[], event: ServerEvent): ChatMessage[] {
    const last = children.at(-1);
    switch (event.type) {
      case "assistant_text":
      case "thinking": {
        const role = event.type === "thinking" ? "thinking" : "assistant";
        if (event.type === "thinking" && event.labelOnly) {
          return [...children, newMessage(this.#nextId++, "thinking", { labelOnly: true })];
        }
        if (!event.text) return children;
        if (last?.role === role && !last.labelOnly) return [...children.slice(0, -1), { ...last, text: last.text + event.text }];
        return [...children, newMessage(this.#nextId++, role, { text: event.text })];
      }
      case "tool_use":
        return [
          ...children,
          newMessage(this.#nextId++, "tool", {
            text: event.input ?? "",
            toolName: event.name,
            toolMcp: event.mcp,
            toolUseId: event.id,
            result: event.result,
          }),
        ];
      case "file_change":
        return [
          ...children,
          newMessage(this.#nextId++, "file_change", {
            toolUseId: event.id,
            toolName: event.tool,
            path: event.path,
            diffLines: event.diffLines,
            labelOnly: event.labelOnly,
          }),
        ];
      case "tool_result":
        return event.toolUseId && event.content !== null
          ? children.map((kid) => (kid.toolUseId === event.toolUseId ? { ...kid, result: event.content } : kid))
          : children;
      default:
        return children;
    }
  }

  #onAgentChild(parent: string, event: ServerEvent) {
    this.messages = this.messages.map((item) =>
      item.role === "agent" && item.toolUseId === parent
        ? { ...item, children: this.#childrenAfter(item.children, event) }
        : item,
    );

    if (event.type === "tool_result" && event.toolUseId) {
      const toolUseId = event.toolUseId;
      this.pendingToolIds = this.pendingToolIds.filter((id) => id !== toolUseId);
    }
  }

  #alreadyShown(body: string, attachments: string[]): boolean {
    const last = this.messages.findLast((item) => item.role === "user");
    if (!last || last.sourceIndex >= 0 || last.text !== body) return false;
    const prefix = `${this.uploadDir}/`;
    const names = (list: string[]) =>
      list.map((item) => (item.startsWith(prefix) ? item.slice(prefix.length) : item)).join("\n");
    return names(last.attachments ?? []) === names(attachments);
  }

  #onDequeued(ids: string[], text: string | null, ts: number | null) {
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
        if (!compacting && !this.#alreadyShown(body, attachments)) {
          this.#append(
            newMessage(this.#nextId++, "user", {
              text: body,
              attachments: attachments.length ? attachments : null,
              timestamp: ts ?? Date.now(),
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
        this.#unacked.delete(id);
        this.#silent.delete(id);
      });
    }
  }

  #onHistoryChunk(sessionId: string, startIndex: number, items: SessionMessage[], hasMore: boolean) {
    if (!this.transcriptPaging) return;
    if (sessionId !== this.sessionId) {
      this.transcriptLoading = false;
      this.transcriptPaging = false;
      return;
    }
    const older = items.filter(isVisible);
    const prepended = this.#nest(
      older.map((item, index) => this.#fromSession(item, this.#nextId + index, sessionId, this.projectKey)),
    );
    this.#nextId += older.length;
    const kept = prepended.some((item) => item.role === "compact")
      ? withoutLiveCompact(this.messages)
      : this.messages;
    this.messages = [...prepended, ...kept];
    this.oldestLoadedIndex = startIndex;
    this.transcriptLoading = false;
    this.transcriptPaging = false;
    this.transcriptExhausted = !hasMore;
  }

  #onTail(items: SessionMessage[]) {
    const sessionId = this.sessionId;
    const visible = sessionId ? items.filter(isVisible) : [];
    if (!visible.length) return;
    const appended = this.#nest(
      visible.map((item, index) =>
        this.#fromSession(item, this.#nextId + index, sessionId as string, this.projectKey),
      ),
    );
    this.#nextId += visible.length;
    this.messages = [...this.messages, ...appended];
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
    this.#sides = Object.fromEntries(
      Object.entries(this.#sides).map(([key, side]) => [key, { ...side, messages: apply(side.messages) }]),
    );
  }

  #componentHeadline(blocks: ComponentElement[]): string | null {
    for (const element of blocks) {
      if (element.type === "page") {
        const nested = this.#componentHeadline(element.blocks);
        if (nested) return nested;
      }
      if (element.type === "text" && element.text) return element.text;
    }
    return null;
  }

  #notificationBody(
    kind: string,
    blocks: ComponentElement[],
    toolName: string | null,
    input: string | null,
    title: string | null,
  ): string | null {
    if (kind === "component") {
      return (title ?? this.#componentHeadline(blocks))?.slice(0, NOTIFICATION_BODY_LENGTH) ?? null;
    }
    if (kind === "mods") return t("MOD_HOT_RELOAD_QUESTION");
    if (toolName !== "ExitPlanMode") return toolName?.slice(0, NOTIFICATION_BODY_LENGTH) ?? null;
    const heading = (input ?? "")
      .split("\n")
      .find((line) => line.trim())
      ?.replace(/^[#\s]+/, "")
      .trim()
      .slice(0, NOTIFICATION_BODY_LENGTH);
    return heading || t("PLAN");
  }

  #awaitingHistory(): boolean {
    return (
      this.agent !== null &&
      this.sessionId !== null &&
      this.agentState?.status === "connecting" &&
      this.messages.length === 0
    );
  }

  #resetStreaming() {
    this.streaming = false;
    this.compacting = false;
    this.streamStatus = null;
    this.pendingToolIds = [];
    this.#assistantId = null;
    this.#thinkingId = null;
    this.#thinkingTokens = null;
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
    if (this.#pendingTrim !== null && event.type !== "ready") {
      const trim = this.#pendingTrim;
      this.#pendingTrim = null;
      this.messages = trim(this.messages);
    }
    switch (event.type) {
      case "connecting":
        this.#abandonPage();
        if (event.resumed || (this.connection !== "connected" && this.connection !== "disconnected")) {
          this.connection = "connecting";
        }
        break;
      case "open":
        this.#startSession(this.sessionId);
        break;
      case "ready": {
        if (this.#frozen === null) this.#settling = this.#heldView();
        void this.#consumeInitialSession(event.project);
        this.connection = "connected";
        this.mods.rebind();
        this.#attaching = true;
        this.#arrivingMods = null;
        this.sessionId = event.sessionId ?? this.sessionId;
        this.projectKey = event.project ?? this.projectKey;
        if (event.cwd && event.cwd !== this.cwd) {
          this.cwd = event.cwd;
          this.onContextChange?.();
        }
        this.streaming = event.running;
        this.activity = event.activity;
        this.resident = event.resident;
        this.backgroundTasks = [];
        const committed = event.committedCount;
        if (!event.resumed || !event.running) {
          this.messages = this.messages.filter((item) => !item.ephemeral);
          this.#pendingTrim = null;
        } else {
          this.#pendingTrim = (list) => {
            const kept = list.filter((item) => !item.ephemeral);
            const awaiting = (item: ChatMessage) => !!item.interaction && isPending(item.interaction);
            if (committed !== null) {
              return kept.filter((item) => awaiting(item) || (item.sourceIndex >= 0 && item.sourceIndex < committed));
            }
            const lastUser = kept.findLastIndex((item) => item.role === "user");
            if (lastUser < 0) return kept;
            return [...kept.slice(0, lastUser + 1), ...kept.slice(lastUser + 1).filter(awaiting)];
          };
        }
        this.#applyQueueSnapshot(event.queued);
        if (!this.agent && event.account && event.account !== this.effectiveAccount) this.#storeAccount(event.account);
        void this.refreshServerInfo();
        this.#pumpQueue();
        if (this.#cutChannel !== null && event.channel !== this.#cutChannel && !event.resumed && !event.running) {
          this.#resetStreaming();
          void this.#reloadConversation();
        }
        this.#cutChannel = null;
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
          this.#append(
            newMessage(this.#nextId++, "thinking", { labelOnly: true, thinkingTokens: this.#thinkingTokens }),
          );
          this.#thinkingTokens = null;
        } else if (event.text) {
          this.#assistantId = null;
          const fresh = this.#thinkingId === null;
          this.#thinkingId = this.#stream(this.#thinkingId, "thinking", event.text);
          if (fresh && this.#thinkingTokens !== null) {
            const tokens = this.#thinkingTokens;
            this.#thinkingTokens = null;
            this.messages = this.messages.map((item) =>
              item.id === this.#thinkingId ? { ...item, thinkingTokens: tokens } : item,
            );
          }
        }
        break;
      case "working":
        this.#assistantId = null;
        this.#thinkingId = null;
        if (this.messages.at(-1)?.role !== "working") this.#append(newMessage(this.#nextId++, "working"));
        break;
      case "plan":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "plan", { text: event.markdown }));
        break;
      case "command": {
        const message = newMessage(this.#nextId++, "assistant", { text: event.markdown, ephemeral: true });
        if (event.local) {
          this.#appendLocal(message);
          break;
        }
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(message);
        break;
      }
      case "component": {
        const message = newMessage(this.#nextId++, "interaction", {
          ephemeral: true,
          interaction: {
            ...emptyInteraction("shown", "component"),
            title: event.title,
            titleKey: event.titleKey,
            icon: event.icon,
            blocks: event.blocks,
          },
        });
        if (event.local) {
          this.#appendLocal(message);
          break;
        }
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(message);
        break;
      }
      case "usage": {
        const message = newMessage(this.#nextId++, "usage", { ephemeral: true, usage: event.usage });
        if (event.local) {
          this.#appendLocal(message);
          break;
        }
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(message);
        break;
      }
      case "reloaded": {
        const text = reloadText(event);
        if (text) this.#appendLocal(newMessage(this.#nextId++, "info", { text, ephemeral: true }));
        break;
      }
      case "notification":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "notification", { text: event.summary, result: event.status }));
        break;
      case "notice":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "notice", { text: event.text, toolName: event.name, result: event.level }));
        break;
      case "mods":
        if (this.#attaching) this.#arrivingMods = event.state;
        else this.mods.applyState(event.state);
        break;
      case "commands":
        if (this.capabilities) this.capabilities = { ...this.capabilities, commands: event.commands };
        break;
      case "mod_toast":
        this.mods.toast(event.plugin, event.text, event.timeoutMs);
        break;
      case "mod_invalidate":
        this.mods.invalidate(event.instances);
        break;
      case "mod_tree":
        this.mods.receive(event.rid, event.component, event.instanceId, event.drawn);
        break;
      case "mod_reply":
        this.mods.reply(event.rid, event.answer);
        break;
      case "mod_request":
        void this.mods.answer(event.request);
        break;
      case "mod_focus":
        this.mods.focus(event.component, event.instanceId, event.plugin, event.key);
        break;
      case "mod_scroll":
        this.mods.scroll(event.component, event.instanceId, event.offset, event.followEnd);
        break;
      case "session_message":
      case "plugin_message":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, event.type, { text: event.text, toolName: event.name }));
        break;
      case "agent_report":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "agent_report", { text: event.text, toolName: event.name }));
        break;
      case "agent":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "agent", {
            text: event.description ?? "",
            toolName: event.subagentType,
            toolUseId: event.id,
            agentRun: { model: event.model, effort: event.effort, agent: event.agent, account: event.account },
          }),
        );
        if (event.id) this.pendingToolIds = [...this.pendingToolIds, event.id];
        break;
      case "task_running":
        if (event.id && !this.backgroundToolIds.includes(event.id)) {
          this.backgroundTasks = [...this.backgroundTasks, { id: event.id, description: event.description }];
        }
        break;
      case "agent_result": {
        const agentId = event.id;
        if (agentId) {
          this.pendingToolIds = this.pendingToolIds.filter((id) => id !== agentId);
          this.backgroundTasks = this.backgroundTasks.filter((task) => task.id !== agentId);
          this.messages = this.messages.map((item) =>
            item.toolUseId === agentId
              ? {
                  ...item,
                  agentResult: {
                    status: event.status,
                    durationMs: event.durationMs,
                    tokens: event.tokens,
                    toolUses: event.toolUses,
                  },
                }
              : item,
          );
        }
        break;
      }
      case "thinking_tokens": {
        this.#thinkingTokens = event.tokens;
        const last = this.messages.at(-1);
        if (last?.role === "thinking" && last.id === this.#thinkingId) {
          this.messages = [...this.messages.slice(0, -1), { ...last, thinkingTokens: event.tokens }];
          this.#thinkingTokens = null;
        }
        break;
      }
      case "hook_failed":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "api_error", {
            text: [t("HOOK_FAILED", event.name ?? "hook"), event.text].filter(Boolean).join("\n"),
            result: "warning",
          }),
        );
        break;
      case "tool_use":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(
          newMessage(this.#nextId++, "tool", {
            text: event.input ?? "",
            toolName: event.name,
            toolMcp: event.mcp,
            toolUseId: event.id,
            result: event.result,
            toolMs: event.ms,
          }),
        );
        if (event.id) this.pendingToolIds = [...this.pendingToolIds, event.id];
        break;
      case "tool_result":
        if (event.toolUseId) {
          const toolUseId = event.toolUseId;
          this.pendingToolIds = this.pendingToolIds.filter((id) => id !== toolUseId);
          if (event.content !== null || event.ms !== null) {
            this.messages = this.messages.map((item) =>
              item.toolUseId === toolUseId
                ? {
                    ...item,
                    result: event.content ?? item.result,
                    toolMs: event.ms ?? item.toolMs,
                  }
                : item,
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
            toolName: event.tool,
            path: event.path,
            diffLines: event.diffLines,
            labelOnly: event.labelOnly,
          }),
        );
        break;
      case "shared":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "shared", { toolUseId: event.id, files: event.files }));
        break;
      case "compacting":
        this.compacting = true;
        break;
      case "compacting_ended":
        this.compacting = false;
        break;
      case "status":
        if (!(this.#interrupting && event.kind === "retrying")) {
          this.streamStatus = event.kind === "ok" ? null : event.kind;
          this.apiRetry = event.retry;
        }
        break;
      case "activity":
        this.activity = event.state;
        this.resident = event.resident;
        break;
      case "agent_state":
        this.agentState = event.state;
        if (event.state.status === "ready") this.agentStarted = true;
        if (event.state.sessionId) this.sessionId = event.state.sessionId;
        if (event.state.status === "auth" || event.state.status === "error") this.transcriptLoading = false;
        break;
      case "history": {
        const sessionId = this.sessionId ?? "";
        const visible = event.items.map(parseSessionMessage).filter(isVisible);
        this.messages = this.#nest(
          visible.map((item, index) => this.#fromSession(item, index, sessionId, this.projectKey)),
        );
        this.#nextId = visible.length;
        this.#assistantId = null;
        this.#thinkingId = null;
        this.expandedIds = {};
        this.oldestLoadedIndex = event.startIndex;
        this.transcriptExhausted = !event.hasMore;
        this.transcriptPaging = false;
        this.transcriptLoading = this.#awaitingHistory();
        break;
      }
      case "stop":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#append(newMessage(this.#nextId++, "api_error", { text: agentStopText(event.reason), result: event.severity }));
        break;
      case "terminal_opened":
        void listTerminals().then((listed) => {
          if (listed) terminalTabs.openLocal(event.session);
        });
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
        this.#history = [];
        this.oldestLoadedIndex = 0;
        this.transcriptExhausted = true;
        this.transcriptPaging = false;
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
      case "queued":
        if (!event.replay && event.id && !this.#sent.has(event.id) && !this.queue.some((item) => item.id === event.id)) {
          this.#sent.add(event.id);
          this.queue = [...this.queue, { id: event.id, text: event.text, attachments: [], uploading: false }];
        }
        break;
      case "queue":
        this.#applyQueueSnapshot(event.items);
        break;
      case "dequeued":
        this.#onDequeued(event.ids, event.text, event.ts);
        break;
      case "tail":
        this.#onTail(event.items.map(parseSessionMessage));
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
        this.contextTokens = event.contextTokens;
        this.contextWindow = event.contextWindow;
        this.requestBytes = event.requestBytes;
        this.mediaBytes = event.mediaBytes;
        break;
      case "cache":
        this.promptCache = event.cache;
        break;
      case "rate_limit":
        liveLimits.set(this.environmentId, this.effectiveAccount, event.windows);
        break;
      case "session_started":
        this.#bindSession(event.sessionId);
        break;
      case "result":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#bindSession(event.sessionId ?? this.sessionId);
        break;
      case "done":
        if (this.streaming && settings.notifyTaskDone && !event.replay) {
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
        this.#flushHeld();
        this.#interrupting = false;
        this.#dropUnborn();
        this.#pumpQueue();
        if (this.#reloadOnDone && !this.streaming) {
          this.#reloadOnDone = false;
          void this.#reloadConversation();
        } else {
          void this.#indexLive();
        }
        break;
      case "attached":
        this.#attaching = false;
        if (this.#arrivingMods) this.mods.applyState(this.#arrivingMods);
        this.#arrivingMods = null;
        void tick()
          .then(() => this.mods.whenDrawn())
          .then(() => {
            this.#frozen = null;
            this.#settling = null;
            this.transcriptLoading = this.#awaitingHistory();
          });
        break;
      case "interrupted":
        this.#interrupting = false;
        this.#assistantId = null;
        this.#thinkingId = null;
        this.messages = this.messages.filter(
          (item) => !(item.role === "interaction" && item.interaction && isPending(item.interaction)),
        );
        this.#append(newMessage(this.#nextId++, "interrupted"));
        this.streaming = false;
        this.compacting = false;
        this.pendingToolIds = [];
        this.streamStatus = null;
        break;
      case "error": {
        this.#resetStreaming();
        const unanswered = this.messages.at(-1);
        if (unanswered?.role === "user") {
          this.messages = [...this.messages.slice(0, -1), { ...unanswered, sendStatus: "error" as const }];
        }
        this.#flushHeld();
        break;
      }
      case "api_error":
        this.#assistantId = null;
        this.#thinkingId = null;
        this.streamStatus = null;
        this.#append(newMessage(this.#nextId++, "api_error", { text: event.message, result: event.severity }));
        break;
      case "interaction_request":
        if (!this.messages.some((item) => item.interaction?.requestId === event.requestId)) {
          this.#assistantId = null;
          this.#thinkingId = null;
          const data: InteractionData = {
            ...emptyInteraction(event.requestId, event.kind),
            options: event.options,
            title: event.title,
            titleKey: event.titleKey,
            icon: event.icon,
            blocks: event.blocks,
            submitLabel: event.submitLabel,
            submitKey: event.submitKey,
            dismiss: event.dismiss,
            present: event.present,
            variant: event.variant,
            mod: event.mod,
            values: componentDefaults(event.blocks),
          };
          if (event.mod) this.mods.seed("AskUserQuestion", event.mod.instanceId, event.mod.drawn);
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
          if (settings.notifyInteraction && !event.replay) {
            const kind = event.kind;
            const silentActions = kind === "component";
            void notifier.notify(
              t(
                kind !== "component"
                  ? "NOTIF_PERMISSION"
                  : data.titleKey === "questions"
                    ? "NOTIF_QUESTION"
                    : "NOTIF_COMPONENT",
              ),
              this.#notificationBody(kind, event.blocks, event.toolName, event.input, data.title),
              this.tabId,
              silentActions
                ? []
                : event.options
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
          if (data.kind === "component") {
            if (data.submitted || data.declined) return data;
            return {
              ...data,
              submitted: true,
              declined: event.dismissed,
              values: event.values ?? data.values,
            };
          }
          return data.resolved === null ? { ...data, resolved: event.optionId ?? "" } : data;
        });
        break;
      case "closed":
        this.#attaching = false;
        this.#arrivingMods = null;
        this.#frozen = null;
        this.#settling = null;
        this.transcriptLoading = false;
        this.#abandonPage();
        this.#assistantId = null;
        this.#thinkingId = null;
        this.#sideAssistantId = null;
        this.connection = "disconnected";
        if (this.streaming || this.pendingToolIds.length) this.#cutChannel ??= this.#socket.channel;
        this.streaming = false;
        this.#flushHeld();
        this.#sides = Object.fromEntries(
          Object.entries(this.#sides).map(([key, side]) => [key, { ...side, streaming: false }]),
        );
        break;
    }
  }
}

