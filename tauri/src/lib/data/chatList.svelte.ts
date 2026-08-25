import { parseProject, parseSession, type ProjectInfo, type SessionInfo } from "./models";
import { isConfigured, profileKey, type Profile } from "$lib/services/backend.svelte";
import { ReconnectingSocket } from "$lib/services/socket";

const byLastActive = <T extends { lastActive: number | null }>(items: T[]) =>
  [...items].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

export class ChatListStore {
  projects = $state<ProjectInfo[]>([]);
  sessions = $state<SessionInfo[]>([]);
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
        this.loading = false;
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
