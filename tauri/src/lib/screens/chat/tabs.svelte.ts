import { ROUTES } from "$lib/app/navigation.svelte";
import { settings, type VisibilityPrefs } from "$lib/data/settings.svelte";
import type { SessionInfo } from "$lib/data/models";
import { backend } from "$lib/services/backend.svelte";
import { ChatState } from "./state.svelte";

export type PaneRole = "center" | "right";

export interface Tab {
  id: string;
  pane: PaneRole;
  environmentId: string | null;
  cwd: string;
  sessionId: string | null;
  projectKey: string | null;
  title: string | null;
  color: string | null;
  running: boolean;
  viewTitle?: string | null;
}

interface StoredTab {
  env?: string;
  cwd?: string;
  sid?: string;
  proj?: string;
  title?: string;
  color?: string;
  side?: boolean;
}

const SESSION_ID_PREVIEW = 8;

const onChatRoute = () => {
  const path = window.location.pathname;
  return !ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
};

export interface ChatLink {
  sessionId: string;
  projectKey: string;
}

export interface ChatLocation {
  tab: number;
  sessionId: string;
  projectKey: string;
  view: boolean;
  right: ChatLink | null;
}

export const readRightLocation = (): ChatLink | null => {
  if (!onChatRoute()) return null;
  const query = new URLSearchParams(window.location.search);
  const sessionId = query.get("r");
  const projectKey = query.get("rp");
  return sessionId && projectKey ? { sessionId, projectKey } : null;
};

export const readFocusedPane = (): PaneRole =>
  onChatRoute() && new URLSearchParams(window.location.search).get("f") === "r" ? "right" : "center";

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
    right: readRightLocation(),
  };
};

class Tabs {
  list = $state<Tab[]>([]);
  activeId = $state("");
  rightActiveId = $state<string | null>(null);
  rightFocused = $state(false);

  #counter = 0;
  #states = new Map<string, { chat: ChatState; stop: () => void }>();

  readonly center = $derived(this.list.filter((tab) => tab.pane === "center"));
  readonly right = $derived(this.list.filter((tab) => tab.pane === "right"));
  readonly active = $derived(this.center.find((tab) => tab.id === this.activeId) ?? this.center[0]);
  readonly state = $derived(this.stateFor(this.active));

  constructor() {
    const restored = this.#restore();
    this.list = restored.tabs;
    const opened = this.list.filter((tab) => tab.pane === "center");
    let activeId = opened[Math.min(Math.max(restored.active, 0), opened.length - 1)]?.id ?? this.list[0].id;

    const location = readChatLocation();
    if (location && !location.view) {
      const known = opened.find((tab) => tab.sessionId === location.sessionId);
      if (known) {
        activeId = known.id;
      } else {
        const target = opened[Math.min(Math.max(location.tab, 0), opened.length - 1)];
        if (target) {
          this.list = this.list.map((tab) =>
            tab.id === target.id
              ? { ...tab, sessionId: location.sessionId, projectKey: location.projectKey }
              : tab,
          );
          activeId = target.id;
        }
      }
    }

    this.activeId = activeId;
  }

  start() {
    const opening = readChatLocation();
    if (opening?.view) {
      const target = this.list[Math.min(Math.max(opening.tab, 0), this.list.length - 1)] ?? this.active;
      this.activeId = target.id;
      void this.stateFor(target).openTrashed(opening.sessionId, opening.projectKey);
    }

    $effect(() => {
      const anchor = backend.active?.id;
      if (!anchor || !this.list.some((tab) => tab.environmentId === null)) return;
      for (const tab of this.list) {
        if (tab.environmentId !== null) continue;
        const entry = this.#states.get(tab.id);
        if (entry) entry.chat.environmentId = anchor;
      }
      this.list = this.list.map((tab) =>
        tab.environmentId === null ? { ...tab, environmentId: anchor } : tab,
      );
      this.#persist();
    });

    $effect(() => {
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

  /** Owns its reactive scope: a state built inside a component derived dies with it. */
  stateFor(tab: Tab): ChatState {
    const existing = this.#states.get(tab.id);
    if (existing) return existing.chat;
    let created!: ChatState;
    const stop = $effect.root(() => {
      created = new ChatState({
        environmentId: tab.environmentId,
        sessionId: tab.sessionId,
        projectKey: tab.projectKey,
        cwd: tab.cwd,
        color: tab.color,
      });
    });
    created.tabId = tab.id;
    created.onContextChange = () => this.#syncContext(tab.id, created);
    this.#states.set(tab.id, { chat: created, stop });
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
    for (const entry of this.#states.values()) entry.chat.reconnect();
  }

  refreshDefaults() {
    for (const entry of this.#states.values()) void entry.chat.refreshServerInfo();
  }

  applyVisibility(prefs: VisibilityPrefs) {
    settings.visibility = prefs;
    for (const entry of this.#states.values()) entry.chat.syncVisibility();
  }

  #blank(environmentId: string | null, cwd: string, pane: PaneRole = "center"): Tab {
    return {
      id: this.#nextId(),
      pane,
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
        pane: (item.side ? "right" : "center") as PaneRole,
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

  openTab(environmentId: string | null, cwd: string, pane: PaneRole = "center"): Tab {
    const tab = this.#blank(environmentId, cwd, pane);
    this.list = [...this.list, tab];
    if (pane === "center") {
      this.activeId = tab.id;
      this.#syncEnvironment();
    }
    this.#persist();
    return tab;
  }

  newTab(categoryId: string | null = null, pane: PaneRole = "center"): Tab {
    const source = pane === "right" ? (this.right.at(-1) ?? this.active) : this.active;
    const environmentId = source?.environmentId ?? backend.active?.id ?? null;
    const directory = backend.environments.find((item) => item.id === environmentId)?.directory ?? "";
    const tab = this.openTab(environmentId, directory, pane);
    if (categoryId) this.stateFor(tab).pendingCategoryId = categoryId;
    return tab;
  }

  openSessionTab(session: SessionInfo, environmentId: string | null, pane: PaneRole = "center"): Tab {
    const tab: Tab = {
      id: this.#nextId(),
      pane,
      environmentId,
      cwd: session.path ?? "",
      sessionId: session.sessionId,
      projectKey: session.projectKey,
      title: session.title ?? session.preview ?? session.sessionId.slice(0, SESSION_ID_PREVIEW),
      color: session.color,
      running: false,
    };
    this.list = [...this.list, tab];
    if (pane === "center") {
      this.activeId = tab.id;
      this.#syncEnvironment();
    }
    this.#persist();
    return tab;
  }

  updateActive(patch: Partial<Omit<Tab, "id">>) {
    if (this.active) this.update(this.active.id, patch);
  }

  update(id: string, patch: Partial<Omit<Tab, "id">>) {
    const current = this.list.find((tab) => tab.id === id);
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
    if (id === this.activeId || !this.center.some((tab) => tab.id === id)) return;
    this.activeId = id;
    this.#syncEnvironment();
    this.#persist();
  }

  close(id: string) {
    const target = this.list.find((tab) => tab.id === id);
    if (!target) return;
    const group = this.list.filter((tab) => tab.pane === target.pane);
    const index = group.findIndex((tab) => tab.id === id);
    const entry = this.#states.get(id);
    entry?.chat.dispose();
    entry?.stop();
    this.#states.delete(id);
    let next = this.list.filter((tab) => tab.id !== id);
    if (!next.some((tab) => tab.pane === "center")) next = [...next, this.#default()];
    this.list = next;
    if (this.activeId === id) {
      const siblings = next.filter((tab) => tab.pane === target.pane);
      this.activeId = siblings[Math.min(index, siblings.length - 1)]?.id ?? this.center[0].id;
    }
    this.#syncEnvironment();
    this.#persist();
  }

  move(id: string, toIndex: number) {
    const target = this.list.find((tab) => tab.id === id);
    if (!target) return;
    const group = this.list.filter((tab) => tab.pane === target.pane);
    const from = group.findIndex((tab) => tab.id === id);
    const to = Math.min(Math.max(toIndex, 0), group.length - 1);
    if (from < 0 || from === to) return;
    const [moved] = group.splice(from, 1);
    group.splice(to, 0, moved);
    const others = this.list.filter((tab) => tab.pane !== target.pane);
    this.list = target.pane === "center" ? [...group, ...others] : [...others, ...group];
  }

  swapPanes() {
    this.list = this.list.map((tab) => ({
      ...tab,
      pane: tab.pane === "center" ? ("right" as PaneRole) : ("center" as PaneRole),
    }));
  }

  commit() {
    this.#persist();
  }

  moveToPane(id: string, pane: PaneRole) {
    const target = this.list.find((tab) => tab.id === id);
    if (!target || target.pane === pane) return;
    this.list = this.list.map((tab) => (tab.id === id ? { ...tab, pane } : tab));
    if (pane === "center" && !this.center.some((tab) => tab.id === this.activeId)) this.activeId = id;
    this.#persist();
  }

  #syncEnvironment() {
    const environmentId = this.active?.environmentId;
    if (environmentId && backend.activeId !== environmentId) backend.select(environmentId);
  }

  #persist() {
    const index = Math.max(
      this.center.findIndex((tab) => tab.id === this.activeId),
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
        ...(tab.pane === "right" ? { side: true } : {}),
      })),
    });
  }

  syncUrl() {
    if (!onChatRoute()) return;
    const current = this.active;
    const index = Math.max(
      this.center.findIndex((tab) => tab.id === this.activeId),
      0,
    );
    const view = current ? this.stateFor(current).viewOnly : null;
    const chat = view ?? (current?.sessionId && current.projectKey ? current : null);
    const query = new URLSearchParams();
    if (chat) {
      query.set("t", String(index));
      query.set("c", chat.sessionId!);
      query.set("p", chat.projectKey!);
      if (view) query.set("v", "1");
    }
    const beside = this.right.find((tab) => tab.id === this.rightActiveId);
    if (beside?.sessionId && beside.projectKey) {
      query.set("r", beside.sessionId);
      query.set("rp", beside.projectKey);
    }
    if (this.rightFocused && query.size) query.set("f", "r");
    const search = query.toString();
    const target = search ? `/?${search}` : "/";
    if (target !== window.location.pathname + window.location.search) {
      window.history.pushState(null, "", target);
    }
  }
}

export const tabs = new Tabs();
