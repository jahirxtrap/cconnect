import { parseProject, parseSession, type ProjectInfo, type SessionInfo } from "./models";
import { backend } from "$lib/services/backend.svelte";
import { ReconnectingSocket } from "$lib/services/socket";

const byLastActive = <T extends { lastActive: number | null }>(items: T[]) =>
  [...items].sort((a, b) => (b.lastActive ?? 0) - (a.lastActive ?? 0));

class ChatList {
  projects = $state<ProjectInfo[]>([]);
  sessions = $state<SessionInfo[]>([]);
  loading = $state(true);
  connected = $state(false);

  #socket: ReconnectingSocket | null = null;
  #key = "";

  start() {
    $effect(() => {
      const key = backend.socketUrl("/list/ws");
      if (!key || key === this.#key) return;
      this.#key = key;
      this.projects = [];
      this.sessions = [];
      this.loading = true;
      this.#socket?.close();
      this.#socket = new ReconnectingSocket("/list/ws", {
        onOpen: () => (this.connected = true),
        onMessage: (message) => this.#apply(message),
        onDrop: () => {
          this.connected = false;
          if (!this.projects.length && !this.sessions.length) this.loading = true;
        },
      });
      this.#socket.connect();
      return () => this.#socket?.close();
    });
  }

  sessionsOf(projectKey: string | null): SessionInfo[] {
    if (!projectKey) return this.sessions;
    return this.sessions.filter((session) => session.projectKey === projectKey);
  }

  #apply(message: Record<string, unknown>) {
    switch (message.type) {
      case "snapshot": {
        const projects = (message.projects as Record<string, unknown>[]) ?? [];
        const sessions = (message.sessions as Record<string, unknown>[]) ?? [];
        this.projects = byLastActive(projects.map(parseProject));
        this.sessions = byLastActive(sessions.map(parseSession));
        this.loading = false;
        break;
      }
      case "session_changed": {
        const session = parseSession((message.session as Record<string, unknown>) ?? {});
        if (!session.sessionId) return;
        this.sessions = byLastActive([
          ...this.sessions.filter((item) => item.sessionId !== session.sessionId),
          session,
        ]);
        break;
      }
      case "session_removed": {
        const sessionId = message.session_id as string;
        this.sessions = this.sessions.filter((item) => item.sessionId !== sessionId);
        break;
      }
      case "project_changed": {
        const project = parseProject((message.project as Record<string, unknown>) ?? {});
        if (!project.projectKey) return;
        this.projects = byLastActive([
          ...this.projects.filter((item) => item.projectKey !== project.projectKey),
          project,
        ]);
        break;
      }
      case "project_removed": {
        const projectKey = message.project_key as string;
        this.projects = this.projects.filter((item) => item.projectKey !== projectKey);
        this.sessions = this.sessions.filter((item) => item.projectKey !== projectKey);
        break;
      }
    }
  }
}

export const chatList = new ChatList();
