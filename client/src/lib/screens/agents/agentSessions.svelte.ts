import { agentFailureText, type AgentFailure, type AgentSession } from "$lib/data/agentModels";
import {
  placementKey,
  projectKeyOf,
  sessionIdPreview,
  type ChatCategory,
  type ChatPlacement,
} from "$lib/data/models";
import { rankLabel } from "$lib/data/textMatch";
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
  renaming = $state<AgentSession | null>(null);
  deleting = $state<AgentSession | null>(null);
  forking = $state<AgentSession | null>(null);
  categorizing = $state<AgentSession | null>(null);
  failure = $state<string | null>(null);

  #seeded = new Set<string>();

  #chat: () => ChatState | null;
  #folder: () => string;
  #role: () => PaneRole;
  #opened: () => void;

  readonly watch: AgentSessionsWatch | null;
  readonly sessions: AgentSession[] | null;
  readonly failed: boolean;
  readonly signedOut: boolean;
  readonly forkable: boolean;
  readonly removable: boolean;
  readonly shown: AgentSession[];
  readonly rightOpenable: boolean;
  readonly projectKey: string;
  readonly categories: ChatCategory[];
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
    this.signedOut = $derived(this.watch?.signedOut ?? false);
    this.shown = $derived.by(() => {
      const listed = this.sessions ?? [];
      if (!this.searching) return listed;
      return listed
        .map((session) => ({ session, rank: rankLabel(sessionTitle(session), this.query) }))
        .filter((item) => item.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .map((item) => item.session);
    });
    this.rightOpenable = $derived(panes.canOpenRight(role()));
    this.forkable = $derived(!!chat()?.agentState?.sessions.fork);
    this.removable = $derived.by(() => {
      const support = chat()?.agentState?.sessions;
      return !!support && (support.delete || !support.list);
    });
    this.projectKey = $derived(projectKeyOf(folder()));
    this.categories = $derived.by(() => {
      const used = new Set((this.sessions ?? []).map((session) => this.placementOf(session)?.categoryId));
      return (chat()?.categories ?? []).filter(
        (category) => category.projectKey === this.projectKey || (!category.projectKey && used.has(category.id)),
      );
    });
    $effect(() => {
      const current = chat();
      const agent = current?.agent;
      if (!current || !agent || current.chatOrder !== "manual" || !this.sessions) return;
      const missing = [...this.sessions]
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .filter((session) => !this.placementOf(session) && !this.#seeded.has(placementKey(agent, session.sessionId)))
        .map((session) => session.sessionId);
      if (!missing.length) return;
      for (const sessionId of missing) this.#seeded.add(placementKey(agent, sessionId));
      void createAgentsApi(() => current.environment).seedOrder(agent, missing);
    });
  }

  placementOf(session: AgentSession): ChatPlacement | undefined {
    const current = this.#chat();
    return current?.agent ? current.placement[placementKey(current.agent, session.sessionId)] : undefined;
  }

  move(sessionId: string, categoryId: string | null, index: number | null, order: string[]) {
    const chat = this.#chat();
    if (!chat?.agent) return;
    chat.list?.movePlacement(chat.agent, sessionId, categoryId, index, order);
    void createAgentsApi(() => chat.environment).place(chat.agent, sessionId, categoryId, index);
  }

  place(session: AgentSession, categoryId: string | null) {
    const chat = this.#chat();
    if (!chat?.agent) return;
    void createAgentsApi(() => chat.environment).place(chat.agent, session.sessionId, categoryId, null);
  }

  async createCategoryWith(name: string, session: AgentSession) {
    this.categorizing = null;
    const chat = this.#chat();
    if (!chat?.agent) return;
    const created = await chat.createCategoryFor(name, this.projectKey);
    if (created) await createAgentsApi(() => chat.environment).place(chat.agent, session.sessionId, created.id, 0);
  }

  newIn(categoryId: string) {
    const chat = this.#chat();
    if (!chat) return;
    agentTabs.restart(chat, this.#folder());
    chat.pendingCategoryId = categoryId;
    this.#opened();
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
    this.forking = null;
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

  async rename(session: AgentSession, title: string) {
    this.renaming = null;
    const chat = this.#chat();
    if (!chat?.agent) return;
    const result = await createAgentsApi(() => chat.environment).rename(chat.agent, this.#folder(), session.sessionId, title);
    if (!result.ok) this.#fail(result.failure);
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
