import {
  parseCategory,
  parsePlacement,
  parseProject,
  parseSession,
  type ChatCategory,
  type ChatPlacement,
  type ProjectInfo,
  type SessionInfo,
} from "./models";
import { isConfigured, profileKey, type Profile } from "$lib/services/backend.svelte";
import { ReconnectingSocket } from "$lib/services/socket";

const byLastActive = <T extends { lastActive: number | null }>(items: T[]) =>
  [...items].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

export class ChatListStore {
  projects = $state<ProjectInfo[]>([]);
  sessions = $state<SessionInfo[]>([]);
  categories = $state<ChatCategory[]>([]);
  placement = $state<Record<string, ChatPlacement>>({});
  loading = $state(true);
  connected = $state(false);

  #socket: ReconnectingSocket;

  constructor(profile: Profile) {
    this.#socket = new ReconnectingSocket(
      "/list/ws",
      {
        onOpen: () => (this.connected = true),
        onMessage: (message) => this.#apply(message),
        onDrop: () => {
          this.connected = false;
          this.sessions = this.sessions.map((item) => (item.activity ? { ...item, activity: null } : item));
          if (!this.projects.length && !this.sessions.length) this.loading = true;
        },
      },
      () => profile,
    );
    this.#socket.connect();
  }

  sessionsOf(projectKey: string | null): SessionInfo[] {
    if (!projectKey) return this.sessions;
    return this.sessions.filter((session) => session.projectKey === projectKey);
  }

  upsertSession(session: SessionInfo) {
    if (!session.sessionId) return;
    this.sessions = byLastActive([
      ...this.sessions.filter((item) => item.sessionId !== session.sessionId),
      session,
    ]);
  }

  removeSession(sessionId: string) {
    this.sessions = this.sessions.filter((item) => item.sessionId !== sessionId);
    this.removePlacement(sessionId);
  }

  upsertCategory(category: ChatCategory) {
    if (!category.id) return;
    this.categories = [...this.categories.filter((item) => item.id !== category.id), category].sort(
      (a, b) => a.position - b.position,
    );
  }

  // The existing positions are dealt out in the new order: made-up ones would sort wrong
  // against the real position the server sends back for the moved category.
  moveCategory(categoryId: string, index: number) {
    const from = this.categories.findIndex((item) => item.id === categoryId);
    if (from < 0) return;
    const target = Math.max(0, Math.min(index, this.categories.length - 1));
    if (target === from) return;
    const positions = this.categories.map((item) => item.position).sort((a, b) => a - b);
    const reordered = [...this.categories];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(target, 0, moved);
    this.categories = reordered.map((item, slot) => ({ ...item, position: positions[slot] }));
  }

  removeCategory(categoryId: string) {
    this.categories = this.categories.filter((item) => item.id !== categoryId);
    this.placement = Object.fromEntries(
      Object.entries(this.placement).map(([key, item]) =>
        item.categoryId === categoryId ? [key, { ...item, categoryId: null }] : [key, item],
      ),
    );
  }

  upsertPlacement(item: ChatPlacement) {
    if (!item.sessionId) return;
    this.placement = { ...this.placement, [item.sessionId]: item };
  }

  removePlacement(sessionId: string) {
    const { [sessionId]: _gone, ...rest } = this.placement;
    this.placement = rest;
  }

  upsertProject(project: ProjectInfo) {
    if (!project.projectKey) return;
    this.projects = byLastActive([
      ...this.projects.filter((item) => item.projectKey !== project.projectKey),
      project,
    ]);
  }

  removeProject(projectKey: string) {
    this.projects = this.projects.filter((item) => item.projectKey !== projectKey);
    this.sessions = this.sessions.filter((item) => item.projectKey !== projectKey);
  }

  #apply(message: Record<string, unknown>) {
    switch (message.type) {
      case "snapshot":
        this.projects = byLastActive(((message.projects as Record<string, unknown>[]) ?? []).map(parseProject));
        this.sessions = byLastActive(((message.sessions as Record<string, unknown>[]) ?? []).map(parseSession));
        this.categories = ((message.categories as Record<string, unknown>[]) ?? [])
          .map(parseCategory)
          .sort((a, b) => a.position - b.position);
        this.placement = Object.fromEntries(
          ((message.placement as Record<string, unknown>[]) ?? []).map(parsePlacement).map((item) => [item.sessionId, item]),
        );
        this.loading = false;
        break;
      case "category_changed":
        this.upsertCategory(parseCategory((message.category as Record<string, unknown>) ?? {}));
        break;
      case "category_removed":
        this.removeCategory(message.category_id as string);
        break;
      case "placement_changed":
        this.upsertPlacement(parsePlacement((message.placement as Record<string, unknown>) ?? {}));
        break;
      case "placement_removed":
        this.removePlacement(message.session_id as string);
        break;
      case "session_changed":
        this.upsertSession(parseSession((message.session as Record<string, unknown>) ?? {}));
        break;
      case "session_removed":
        this.removeSession(message.session_id as string);
        break;
      case "project_changed":
        this.upsertProject(parseProject((message.project as Record<string, unknown>) ?? {}));
        break;
      case "project_removed":
        this.removeProject(message.project_key as string);
        break;
    }
  }
}

const stores = new Map<string, ChatListStore>();

export const chatListFor = (profile: Profile): ChatListStore | null => {
  if (!isConfigured(profile)) return null;
  const key = profileKey(profile);
  const existing = stores.get(key);
  if (existing) return existing;
  const created = new ChatListStore(profile);
  stores.set(key, created);
  return created;
};
