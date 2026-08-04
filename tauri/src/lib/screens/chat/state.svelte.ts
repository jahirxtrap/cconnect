import { chatList } from "$lib/data/chatList.svelte";
import { settings } from "$lib/data/settings.svelte";
import type { SessionInfo } from "$lib/data/models";
import { sessionsApi } from "$lib/services/sessionsApi";

class ChatState {
  sessionId = $state<string | null>(null);
  projectKey = $state<string | null>(null);
  cwd = $state(settings.cwd);
  historyProjectKey = $state<string | null>(null);

  readonly historySessions = $derived(chatList.sessionsOf(this.historyProjectKey));

  openSession(session: SessionInfo) {
    this.sessionId = session.sessionId;
    this.projectKey = session.projectKey;
    this.cwd = session.path ?? this.cwd;
    settings.cwd = this.cwd;
  }

  newSession() {
    this.sessionId = null;
  }

  selectHistoryProject(projectKey: string | null) {
    this.historyProjectKey = projectKey;
  }

  async autoRename(session: SessionInfo) {
    if (!session.projectKey) return;
    await sessionsApi.autoRename(session.sessionId, session.projectKey);
  }

  async rename(session: SessionInfo, title: string) {
    if (!session.projectKey) return;
    await sessionsApi.rename(session.sessionId, session.projectKey, title);
  }

  async setColor(session: SessionInfo, color: string) {
    if (!session.projectKey) return;
    await sessionsApi.setColor(session.sessionId, session.projectKey, color);
  }

  async remove(session: SessionInfo) {
    if (!session.projectKey) return;
    await sessionsApi.remove(session.sessionId, session.projectKey);
    if (this.sessionId === session.sessionId) this.newSession();
  }
}

export const chatState = new ChatState();
