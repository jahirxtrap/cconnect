import { settings } from "$lib/data/settings.svelte";
import type { SessionInfo } from "$lib/data/models";
import { backend } from "$lib/services/backend.svelte";
import { ChatState } from "./state.svelte";

export interface Tab {
  id: string;
  environmentId: string | null;
  cwd: string;
  sessionId: string | null;
  projectKey: string | null;
  title: string | null;
  color: string | null;
  running: boolean;
  /** Name of the chat being read: the tab has no session of its own while it is up, and it is
   *  not persisted — a restored tab is a blank one, never a view of something deleted. */
  viewTitle?: string | null;
}

interface StoredTab {
  env?: string;
  cwd?: string;
  sid?: string;
  proj?: string;
  title?: string;
  color?: string;
}

const SESSION_ID_PREVIEW = 8;

const CHAT_ROUTES = ["/settings", "/claude", "/monitor", "/files", "/terminal", "/markdown"];

const onChatRoute = () => !CHAT_ROUTES.includes(window.location.pathname);

export interface ChatLocation {
  tab: number;
  sessionId: string;
  projectKey: string;
  /** The chat is being read from the trash: same identity, read from somewhere else. */
  view: boolean;
}

export const readChatLocation = (): ChatLocation | null => {
  if (!onChatRoute()) return null;
  const query = new URLSearchParams(window.location.search);
  const sessionId = query.get("c");
  const projectKey = query.get("p");
  if (!sessionId || !projectKey) return null;
  return {
    tab: Number.parseInt(query.get("t") ?? "0", 10) || 0,
    sessionId,
    projectKey,
    view: query.get("v") === "1",
  };
};

class Tabs {
  list = $state<Tab[]>([]);
  activeId = $state("");

  #counter = 0;
  #states = new Map<string, ChatState>();

  readonly active = $derived(this.list.find((tab) => tab.id === this.activeId) ?? this.list[0]);
  readonly state = $derived(this.stateFor(this.active));

  constructor() {
    const restored = this.#restore();
    this.list = restored.tabs;
    let active = restored.active;

    const location = readChatLocation();
    // A view-only entry never becomes the tab's session: `start()` opens it for reading instead.
    if (location && !location.view) {
      const known = this.list.findIndex((tab) => tab.sessionId === location.sessionId);
      if (known >= 0) {
        active = known;
      } else {
        const index = Math.min(Math.max(location.tab, 0), this.list.length - 1);
        this.list = this.list.map((tab, i) =>
          i === index ? { ...tab, sessionId: location.sessionId, projectKey: location.projectKey } : tab,
        );
        active = index;
      }
    }

    this.activeId = this.list[active]?.id ?? this.list[0].id;
  }

  start() {
    const opening = readChatLocation();
    if (opening?.view) {
      const target = this.list[Math.min(Math.max(opening.tab, 0), this.list.length - 1)] ?? this.active;
      this.activeId = target.id;
      void this.stateFor(target).openTrashed(opening.sessionId, opening.projectKey);
    }

    $effect(() => {
      // Going back has to land on the chat the entry points at, not only on a tab that happens to
      // hold it: most history is made switching chats inside one tab, and that tab has to follow.
      const onPopState = () => {
        if (!onChatRoute()) return;
        const location = readChatLocation();
        if (!location) {
          this.stateFor(this.active).newSession();
          return;
        }
        if (location.view) {
          void this.stateFor(this.active).openTrashed(location.sessionId, location.projectKey);
          return;
        }
        const open = this.list.find((tab) => tab.sessionId === location.sessionId);
        if (open) {
          this.select(open.id);
          return;
        }
        this.stateFor(this.active).restoreSession(location.sessionId, location.projectKey);
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });
  }

  #nextId() {
    return `tab${this.#counter++}`;
  }

  stateFor(tab: Tab): ChatState {
    const existing = this.#states.get(tab.id);
    if (existing) return existing;
    const created = new ChatState({
      environmentId: tab.environmentId,
      sessionId: tab.sessionId,
      projectKey: tab.projectKey,
      cwd: tab.cwd,
      color: tab.color,
    });
    created.tabId = tab.id;
    created.onContextChange = () => this.#syncContext(tab.id, created);
    this.#states.set(tab.id, created);
    return created;
  }

  #syncContext(id: string, state: ChatState) {
    const current = this.list.find((tab) => tab.id === id);
    if (!current || (current.environmentId === state.environmentId && current.cwd === state.cwd)) return;
    this.list = this.list.map((tab) =>
      tab.id === id ? { ...tab, environmentId: state.environmentId, cwd: state.cwd } : tab,
    );
    this.#persist();
  }

  reconnectAll() {
    for (const state of this.#states.values()) state.reconnect();
  }

  refreshDefaults() {
    for (const state of this.#states.values()) void state.refreshServerInfo();
  }

  #blank(environmentId: string | null, cwd: string): Tab {
    return {
      id: this.#nextId(),
      environmentId,
      cwd,
      sessionId: null,
      projectKey: null,
      title: null,
      color: null,
      running: false,
    };
  }

  #default(): Tab {
    return this.#blank(backend.active?.id ?? null, backend.active?.directory ?? "");
  }

  #restore(): { tabs: Tab[]; active: number } {
    const raw = settings.tabsState;
    if (!raw) return { tabs: [this.#default()], active: 0 };
    try {
      const stored = JSON.parse(raw) as { active?: number; tabs?: StoredTab[] };
      const tabs = (stored.tabs ?? []).map((item) => ({
        id: this.#nextId(),
        environmentId: item.env ?? null,
        cwd: item.cwd ?? "",
        sessionId: item.sid ?? null,
        projectKey: item.proj ?? null,
        title: item.title ?? null,
        color: item.color ?? null,
        running: false,
      }));
      if (!tabs.length) return { tabs: [this.#default()], active: 0 };
      return { tabs, active: Math.min(Math.max(stored.active ?? 0, 0), tabs.length - 1) };
    } catch {
      return { tabs: [this.#default()], active: 0 };
    }
  }

  openTab(environmentId: string | null, cwd: string): Tab {
    const tab = this.#blank(environmentId, cwd);
    this.list = [...this.list, tab];
    this.activeId = tab.id;
    this.#syncEnvironment();
    this.#persist();
    return tab;
  }

  /** `categoryId` lands the chat in that category as soon as the session gets an id. */
  newTab(categoryId: string | null = null): Tab {
    const environmentId = this.active?.environmentId ?? backend.active?.id ?? null;
    const directory = backend.environments.find((item) => item.id === environmentId)?.directory ?? "";
    const tab = this.openTab(environmentId, directory);
    if (categoryId) this.stateFor(tab).pendingCategoryId = categoryId;
    return tab;
  }

  openSessionTab(session: SessionInfo, environmentId: string | null): Tab {
    const tab: Tab = {
      id: this.#nextId(),
      environmentId,
      cwd: session.path ?? "",
      sessionId: session.sessionId,
      projectKey: session.projectKey,
      title: session.title ?? session.preview ?? session.sessionId.slice(0, SESSION_ID_PREVIEW),
      color: session.color,
      running: false,
    };
    this.list = [...this.list, tab];
    this.activeId = tab.id;
    this.#syncEnvironment();
    this.#persist();
    return tab;
  }

  updateActive(patch: Partial<Omit<Tab, "id">>) {
    const current = this.active;
    if (!current) return;
    const next = { ...current, ...patch };
    if (next.sessionId === null) {
      next.title = null;
      next.color = null;
    }
    if (next.viewTitle) next.title = next.viewTitle;
    const changed = Object.keys(patch).some((key) => current[key as keyof Tab] !== next[key as keyof Tab]);
    if (!changed) return;
    this.list = this.list.map((tab) => (tab.id === current.id ? next : tab));
    this.#persist();
  }

  applyLiveSessions(sessions: SessionInfo[]) {
    if (!sessions.length) return;
    const byId = new Map(sessions.map((session) => [session.sessionId, session]));
    let changed = false;
    const next = this.list.map((tab) => {
      const session = tab.sessionId ? byId.get(tab.sessionId) : undefined;
      if (!session) return tab;
      const title = session.title ?? session.preview ?? session.sessionId.slice(0, SESSION_ID_PREVIEW);
      if (tab.title === title && tab.color === session.color) return tab;
      changed = true;
      return { ...tab, title, color: session.color };
    });
    if (!changed) return;
    this.list = next;
    this.#persist();
  }

  select(id: string) {
    if (id === this.activeId || !this.list.some((tab) => tab.id === id)) return;
    this.activeId = id;
    this.#syncEnvironment();
    this.#persist();
  }

  close(id: string) {
    const index = this.list.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    this.#states.get(id)?.dispose();
    this.#states.delete(id);
    let next = this.list.filter((tab) => tab.id !== id);
    if (!next.length) next = [this.#default()];
    this.list = next;
    if (this.activeId === id) this.activeId = next[Math.min(index, next.length - 1)].id;
    this.#syncEnvironment();
    this.#persist();
  }

  closeActive() {
    this.close(this.activeId);
  }

  selectNext() {
    const index = this.list.findIndex((tab) => tab.id === this.activeId);
    if (index < 0 || this.list.length < 2) return;
    this.select(this.list[(index + 1) % this.list.length].id);
  }

  selectPrev() {
    const index = this.list.findIndex((tab) => tab.id === this.activeId);
    if (index < 0 || this.list.length < 2) return;
    this.select(this.list[(index - 1 + this.list.length) % this.list.length].id);
  }

  moveActive(delta: number) {
    this.move(this.activeId, this.list.findIndex((tab) => tab.id === this.activeId) + delta);
  }

  move(id: string, toIndex: number) {
    const from = this.list.findIndex((tab) => tab.id === id);
    if (from < 0) return;
    const to = Math.min(Math.max(toIndex, 0), this.list.length - 1);
    if (from === to) return;
    const next = [...this.list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    this.list = next;
    this.#persist();
  }

  #syncEnvironment() {
    const environmentId = this.active?.environmentId;
    if (environmentId && backend.activeId !== environmentId) backend.select(environmentId);
  }

  #persist() {
    const index = Math.max(
      this.list.findIndex((tab) => tab.id === this.activeId),
      0,
    );
    this.syncUrl();
    settings.tabsState = JSON.stringify({
      active: index,
      tabs: this.list.map((tab) => ({
        ...(tab.environmentId ? { env: tab.environmentId } : {}),
        cwd: tab.cwd,
        ...(tab.sessionId ? { sid: tab.sessionId } : {}),
        ...(tab.projectKey ? { proj: tab.projectKey } : {}),
        ...(tab.title ? { title: tab.title } : {}),
        ...(tab.color ? { color: tab.color } : {}),
      })),
    });
  }

  syncUrl() {
    if (!onChatRoute()) return;
    const current = this.active;
    const index = Math.max(
      this.list.findIndex((tab) => tab.id === this.activeId),
      0,
    );
    // A chat read from the trash has no session of its own, so its identity comes from what is
    // being read; `v=1` is the one thing the URL adds — where to read it from.
    const view = current ? this.stateFor(current).viewOnly : null;
    const chat = view ?? (current?.sessionId && current.projectKey ? current : null);
    const target = chat
      ? `/?t=${index}&c=${encodeURIComponent(chat.sessionId!)}&p=${encodeURIComponent(chat.projectKey!)}` +
        (view ? "&v=1" : "")
      : "/";
    if (target !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", target);
    }
  }
}

export const tabs = new Tabs();
