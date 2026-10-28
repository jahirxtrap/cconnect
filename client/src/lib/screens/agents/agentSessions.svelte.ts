import { rankLabel } from "$lib/app/commands.svelte";
import { agentFailureText, type AgentFailure, type AgentSession } from "$lib/data/agentModels";
import { sessionIdPreview } from "$lib/data/models";
import { t } from "$lib/i18n/index.svelte";
import { agentSessionsFor, type AgentSessionsWatch } from "$lib/services/agentSessionsWatch.svelte";
import { createAgentsApi } from "$lib/services/agentsApi";
import { panes } from "$lib/screens/chat/panes.svelte";
import type { ChatState } from "$lib/screens/chat/state.svelte";
import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
import { agentTabs } from "./agentTabs.svelte";

export const sessionTitle = (session: AgentSession) => session.title ?? sessionIdPreview(session.sessionId);

export class AgentSessionList {
  query = $state("");
  deleting = $state<AgentSession | null>(null);
  failure = $state<string | null>(null);

  #chat: () => ChatState | null;
  #folder: () => string;
  #role: () => PaneRole;
  #opened: () => void;

  readonly watch: AgentSessionsWatch | null;
  readonly sessions: AgentSession[] | null;
  readonly failed: boolean;
  readonly forkable: boolean;
  readonly removable: boolean;
  readonly shown: AgentSession[];
  readonly searching = $derived(this.query.trim().length > 0);

  constructor(chat: () => ChatState | null, folder: () => string, role: () => PaneRole, opened: () => void) {
    this.#chat = chat;
    this.#folder = folder;
    this.#role = role;
    this.#opened = opened;
    this.watch = $derived.by(() => {
      const current = chat();
      return current?.agent && current.environment ? agentSessionsFor(current.environment, current.agent, folder()) : null;
    });
    this.sessions = $derived(this.watch?.sessions ?? null);
    this.failed = $derived(this.watch?.failed ?? false);
    this.shown = $derived.by(() => {
      const listed = this.sessions ?? [];
      if (!this.searching) return listed;
      return listed
        .map((session) => ({ session, rank: rankLabel(sessionTitle(session), this.query) }))
        .filter((item) => item.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .map((item) => item.session);
    });
    this.forkable = $derived(!!chat()?.agentState?.sessions.fork);
    this.removable = $derived.by(() => {
      const support = chat()?.agentState?.sessions;
      return !!support && (support.delete || !support.list);
    });
  }

  open(session: AgentSession) {
    panes.loadAgentSession(this.#role(), session.sessionId, this.#folder());
    this.#opened();
  }

  openTab(session: AgentSession) {
    this.#openIn(this.#role(), session.sessionId);
  }

  openRight(session: AgentSession) {
    this.#openIn("right", session.sessionId);
  }

  async fork(session: AgentSession) {
    const chat = this.#chat();
    if (!chat?.agent) return;
    const result = await createAgentsApi(() => chat.environment).fork(chat.agent, this.#folder(), session.sessionId);
    if (!result.ok || !result.value) {
      this.#fail(result.failure);
      return;
    }
    this.#openIn(this.#role(), result.value);
  }

  #openIn(pane: PaneRole, sessionId: string) {
    panes.openAgentTab(this.#role(), pane, sessionId, this.#folder());
    this.#opened();
  }

  async remove(session: AgentSession) {
    this.deleting = null;
    const chat = this.#chat();
    if (!chat?.agent) return;
    const folder = this.#folder();
    const result = await createAgentsApi(() => chat.environment).forget(chat.agent, folder, session.sessionId);
    if (!result.ok) {
      this.#fail(result.failure);
      return;
    }
    if (session.sessionId === chat.sessionId) agentTabs.restart(chat, folder);
  }

  #fail(failure: AgentFailure | null) {
    this.failure = failure ? agentFailureText(failure) : t("CONNECTION_ERROR");
  }
}
