import type { SessionInfo } from "$lib/data/models";
import { paneFocus, type Pane } from "$lib/data/paneFocus.svelte";
import { settings } from "$lib/data/settings.svelte";
import { layout } from "$lib/platform/layout.svelte";
import type { ClaudeKind } from "$lib/screens/claude/ClaudeDetail.svelte";
import { agentTabs } from "$lib/screens/agents/agentTabs.svelte";
import { closeProjectFile, opened } from "$lib/screens/project/openFile.svelte";
import { backend } from "$lib/services/backend.svelte";
import { readFocusedPane, readRightLocation, tabs, type PaneRole } from "./tabs.svelte";

export type RightKind =
  | "terminal"
  | "chat"
  | "notes"
  | "monitor"
  | "claude"
  | "shared"
  | "project"
  | "browser"
  | "mods"
  | "agents";

const KINDS: RightKind[] = [
  "terminal",
  "chat",
  "notes",
  "monitor",
  "claude",
  "shared",
  "project",
  "browser",
  "mods",
  "agents",
];

const DEFAULT_TOOL: RightKind = "terminal";

const CHAT: RightKind = "chat";

const AGENTS: RightKind = "agents";

const BOTH_PANES: RightKind[] = [CHAT, AGENTS];

const FILE_VIEWS: RightKind[] = ["project", "shared"];

const SCOPE: Record<RightKind, Pane> = {
  terminal: "terminal",
  chat: "chat",
  notes: "chat",
  monitor: "chat",
  claude: "chat",
  shared: "shared",
  project: "chat",
  browser: "browser",
  mods: "mods",
  agents: "chat",
};

interface StoredRight {
  open?: boolean;
  kind?: string;
  tab?: number;
  center?: string;
}

export interface SideList {
  kind: RightKind;
  role: PaneRole;
}

export const otherPane = (role: PaneRole): PaneRole => (role === "center" ? "right" : "center");

const isChatView = (kind: RightKind) => kind === CHAT;

const restoredKind = (stored: string | undefined, fallback: RightKind): RightKind =>
  KINDS.includes(stored as RightKind) ? (stored as RightKind) : fallback;

class Panes {
  open = $state(false);
  kind = $state<RightKind>(DEFAULT_TOOL);
  centerKind = $state<RightKind>(CHAT);
  rightTabId = $state<string | null>(null);
  focused = $state<PaneRole>("center");
  dropTarget = $state<PaneRole | null>(null);
  previewing = $state(false);
  centerView = $state(settings.viewInCenter);
  claudeDetail = $state<ClaudeKind | null>(null);
  noteId = $state<string | null>(null);

  #wideOpen = false;
  #mobile = layout.mobile;
  #tool = $state<RightKind>(DEFAULT_TOOL);
  #listed: SideList = { kind: CHAT, role: "center" };

  readonly tool = $derived(this.#tool === this.centerKind ? DEFAULT_TOOL : this.#tool);

  readonly overlaid = $derived(this.open && this.kind !== this.centerKind);

  readonly split = $derived(this.open && !layout.mobile);

  readonly swappable = $derived(
    layout.mobile ? this.open && BOTH_PANES.includes(this.kind) && this.kind !== this.centerKind : this.split,
  );

  readonly rightTab = $derived(
    tabs.right.find((tab) => tab.id === this.rightTabId) ?? tabs.right[0] ?? null,
  );

  readonly viewing = $derived(this.previewing || opened.path !== null);

  readonly target = $derived<PaneRole>(
    this.groupAt(this.focused) ?? this.groupAt(otherPane(this.focused)) ?? "center",
  );

  readonly onSecondary = $derived(this.target === "right");

  readonly onTool = $derived(this.shownAt(this.focused) && !isChatView(this.viewAt(this.focused)));

  readonly focusedTab = $derived(this.target === "right" && this.rightTab ? this.rightTab : tabs.active);

  readonly focusedChat = $derived(this.focusedTab ? tabs.stateFor(this.focusedTab) : tabs.state);

  readonly list = $derived.by((): SideList => {
    const current = this.#listAt(this.focused);
    if (current) {
      this.#listed = current;
      return current;
    }
    const { kind, role } = this.#listed;
    if (this.shownAt(role) && this.viewAt(role) === kind) return this.#listed;
    return this.#listAt(otherPane(this.focused)) ?? this.#listed;
  });

  readonly listChat = $derived.by(() => {
    if (this.list.kind !== CHAT) return this.focusedChat;
    const tab = this.list.role === "right" ? this.rightTab : tabs.active;
    return tab ? tabs.stateFor(tab) : tabs.state;
  });

  readonly listEnvironment = $derived(
    this.list.kind === AGENTS
      ? (agentTabs.activeIn(this.list.role)?.environmentId ?? null)
      : this.listChat.environmentId,
  );

  readonly filesRole = $derived<PaneRole>(
    this.shownAt(this.focused) && FILE_VIEWS.includes(this.viewAt(this.focused))
      ? this.focused
      : (FILE_VIEWS.map((kind) => this.roleOf(kind)).find((role) => role !== null) ?? "right"),
  );

  readonly busyRole = $derived.by((): PaneRole | null => {
    if (layout.mobile || !this.centerView || !this.viewing) return null;
    return otherPane(this.previewing ? this.filesRole : (this.roleOf("project") ?? "right"));
  });

  readonly centerBusy = $derived(this.busyRole === "center");

  readonly previewFits = $derived(this.open || this.filesRole === "center");

  constructor() {
    try {
      const stored = JSON.parse(settings.rightPane || "{}") as StoredRight;
      this.kind = restoredKind(stored.kind, DEFAULT_TOOL);
      this.centerKind = restoredKind(stored.center, CHAT);
      if (this.centerKind === this.kind && !BOTH_PANES.includes(this.kind)) this.centerKind = CHAT;
      if (this.kind !== this.centerKind) this.#tool = this.kind;
      this.#wideOpen = stored.open === true;
      this.open = this.#wideOpen && !layout.mobile;
      this.rightTabId = tabs.right[stored.tab ?? 0]?.id ?? tabs.right[0]?.id ?? null;
    } catch {
      this.rightTabId = tabs.right[0]?.id ?? null;
    }
    if (layout.mobile) this.#mainInCenter();

    this.focused = this.open ? readFocusedPane() : "center";
    const link = readRightLocation();
    if (link) {
      const known = tabs.right.find((tab) => tab.sessionId === link.sessionId);
      this.rightTabId =
        known?.id ??
        tabs.openSessionTab(
          { sessionId: link.sessionId, projectKey: link.projectKey } as SessionInfo,
          tabs.active?.environmentId ?? null,
          "right",
        ).id;
      this.kind = CHAT;
      this.open = true;
    }
    tabs.rightActiveId = this.#shownRight();
    tabs.rightFocused = this.focused === "right";
  }

  viewAt(role: PaneRole): RightKind {
    return role === "center" ? this.centerKind : this.kind;
  }

  shownAt(role: PaneRole): boolean {
    return role === "center" || this.open;
  }

  roleOf(kind: RightKind): PaneRole | null {
    if (this.centerKind === kind) return "center";
    return this.open && this.kind === kind ? "right" : null;
  }

  shows(kind: RightKind): boolean {
    return this.roleOf(kind) !== null;
  }

  groupAt(role: PaneRole): PaneRole | null {
    return this.shownAt(role) && isChatView(this.viewAt(role)) ? role : null;
  }

  tabAt(role: PaneRole) {
    if (this.groupAt(role) === null) return null;
    return role === "right" ? this.rightTab : (tabs.active ?? null);
  }

  environmentAt(role: PaneRole): string | null {
    if (this.groupAt(role) !== null) return this.tabAt(role)?.environmentId ?? null;
    if (this.shownAt(role) && this.viewAt(role) === AGENTS) return agentTabs.activeIn(role)?.environmentId ?? null;
    return backend.activeId;
  }

  historyInList(role: PaneRole): boolean {
    return !layout.mobile || role === "center";
  }

  #listAt(role: PaneRole): SideList | null {
    if (layout.mobile) return { kind: this.centerKind === AGENTS ? AGENTS : CHAT, role: "center" };
    if (!this.shownAt(role)) return null;
    const kind = this.viewAt(role);
    return BOTH_PANES.includes(kind) ? { kind, role } : null;
  }

  revealList() {
    const { kind, role } = this.list;
    if (this.shownAt(role) && this.viewAt(role) === kind) return;
    if (kind === CHAT) this.focus(this.#bring(role));
    else this.setView(role, kind);
    this.commit();
  }

  newListChat() {
    const { kind, role } = this.list;
    if (kind === AGENTS) {
      const chat = agentTabs.usableState(agentTabs.activeIn(role));
      if (chat) agentTabs.restart(chat, agentTabs.folderOf(chat));
    } else {
      this.listChat.newSession();
    }
    this.revealList();
  }

  loadAgentSession(role: PaneRole, sessionId: string, cwd: string) {
    const tab = agentTabs.activeIn(role);
    if (!tab) return;
    agentTabs.load(tab, sessionId, cwd);
    this.#showAgents(role);
  }

  openAgentTab(from: PaneRole, to: PaneRole, sessionId: string, cwd: string) {
    const tab = agentTabs.activeIn(from);
    if (!tab) return;
    agentTabs.openSession(to, tab, sessionId, cwd);
    this.#showAgents(to);
  }

  #showAgents(role: PaneRole) {
    if (this.shownAt(role) && this.viewAt(role) === AGENTS) this.focus(role);
    else this.setView(role, AGENTS);
    this.commit();
  }

  swap() {
    if (!this.swappable) return;
    const center = this.centerKind;
    this.centerKind = this.kind;
    this.#place("right", center);
    this.#swapTabs();
    if (layout.mobile) this.open = false;
    this.#settleChats();
    this.focus(layout.mobile ? "center" : otherPane(this.focused));
    this.commit();
  }

  #swapTabs() {
    const active = tabs.activeId;
    tabs.swapPanes();
    if (!tabs.center.length) tabs.newTab(null, "center");
    tabs.activeId = this.rightTabId ?? tabs.center[0]?.id ?? active;
    this.rightTabId = active;
    agentTabs.swapPanes();
  }

  setView(role: PaneRole, kind: RightKind) {
    this.previewing = false;
    const other = otherPane(role);
    if (this.viewAt(other) === kind && !BOTH_PANES.includes(kind)) this.#place(other, this.viewAt(role));
    this.#place(role, kind);
    if (role === "right") this.open = true;
    if (!this.shows("project")) closeProjectFile();
    this.#settleChats();
    this.focus(role);
    this.commit();
  }

  setKind(kind: RightKind) {
    this.setView("right", kind);
  }

  show(kind: RightKind) {
    const at = this.roleOf(kind);
    if (at) {
      this.focus(at);
      this.commit();
      return;
    }
    this.setView("right", kind);
  }

  adoptLayout(mobile: boolean) {
    if (mobile === this.#mobile) return;
    this.#mobile = mobile;
    if (mobile) this.#mainInCenter();
    this.setOpen(mobile ? false : this.#wideOpen);
  }

  setOpen(open: boolean) {
    this.open = open;
    this.#settleChats();
    this.focus(open ? "right" : "center");
    this.commit();
  }

  #place(role: PaneRole, kind: RightKind) {
    if (role === "center") {
      this.centerKind = kind;
      return;
    }
    this.kind = kind;
    if (kind !== this.centerKind) this.#tool = kind;
  }

  #mainInCenter() {
    if (BOTH_PANES.includes(this.centerKind)) return;
    const away = this.centerKind;
    this.centerKind = CHAT;
    this.#place("right", away);
  }

  #bring(role: PaneRole): PaneRole {
    if (this.groupAt(role) !== null) return role;
    if (role === "right") {
      this.#place("right", CHAT);
      this.open = true;
      return "right";
    }
    const away = this.centerKind;
    this.centerKind = CHAT;
    if (this.shows(away) || isChatView(this.kind)) return "center";
    this.#place("right", away);
    if (away === AGENTS) agentTabs.swapPanes();
    return "center";
  }

  #settleChats() {
    if (!(this.open && this.kind === CHAT)) {
      this.#dropBlankChats();
      return;
    }
    if (!this.rightTab) this.rightTabId = tabs.newTab(null, "right").id;
  }

  #shownRight(): string | null {
    return this.kind === CHAT ? (this.rightTab?.id ?? null) : null;
  }

  #dropBlankChats() {
    for (const tab of tabs.right) {
      if (tab.sessionId !== null) continue;
      const state = tabs.liveState(tab.id);
      if (state && !state.untouched) continue;
      if (tab.id === this.rightTabId) this.rightTabId = null;
      tabs.close(tab.id);
    }
  }

  showCenterView(value: boolean) {
    this.centerView = value;
    settings.viewInCenter = value;
    if (!this.viewing) return;
    if (!value && this.filesRole === "right") this.open = true;
    this.focus(value ? (this.busyRole ?? this.filesRole) : this.filesRole);
    this.commit();
  }

  showPreview() {
    this.previewing = true;
    if (this.filesRole === "right" || this.busyRole === "right") this.open = true;
    this.focus(this.filesRole);
    this.commit();
  }

  closePreview() {
    if (!this.previewing) return;
    this.previewing = false;
    this.focus(this.filesRole);
    this.commit();
  }

  selectSibling(delta: number) {
    if (this.onTool) return false;
    const group = this.target === "right" ? tabs.right : tabs.center;
    if (group.length < 2) return;
    const currentId = this.target === "right" ? this.rightTab?.id : tabs.activeId;
    const index = group.findIndex((tab) => tab.id === currentId);
    if (index < 0) return;
    const next = group[(index + delta + group.length) % group.length];
    if (this.target === "right") this.showTab(next.id);
    else tabs.select(next.id);
  }

  moveFocused(delta: number) {
    if (this.onTool) return false;
    const target = this.focusedTab;
    if (!target) return;
    const group = this.target === "right" ? tabs.right : tabs.center;
    const index = group.findIndex((tab) => tab.id === target.id);
    if (index < 0) return;
    tabs.move(target.id, index + delta);
    tabs.commit();
  }

  close(id: string) {
    if (id === this.rightTabId) this.rightTabId = null;
    tabs.close(id);
    this.#settleChats();
    this.commit();
  }

  moveToPane(id: string, role: PaneRole) {
    const tab = tabs.list.find((item) => item.id === id);
    if (!tab || tab.pane === role) return;
    if (id === this.rightTabId) this.rightTabId = null;
    tabs.moveToPane(id, role);
    if (role === "right") this.rightTabId = id;
    this.#bring(role);
    this.#settleChats();
    this.focus(role);
    this.commit();
  }

  dragTab(id: string, role: PaneRole): boolean {
    const pane = tabs.list.find((item) => item.id === id)?.pane ?? null;
    if (pane === role || this.groupAt(role) === null) return false;
    this.moveToPane(id, role);
    return true;
  }

  dragAgentTab(id: string, role: PaneRole): boolean {
    const pane = agentTabs.list.find((item) => item.id === id)?.pane ?? null;
    if (pane === role || !this.shownAt(role) || this.viewAt(role) !== AGENTS) return false;
    agentTabs.moveToPane(id, role);
    this.focus(role);
    return true;
  }

  dropTab() {
    tabs.commit();
  }

  reveal(id: string) {
    const tab = tabs.list.find((item) => item.id === id);
    if (!tab) return;
    if (tab.pane === "right") {
      this.showTab(id);
      return;
    }
    tabs.select(id);
    this.focus(this.#bring("center"));
    this.commit();
  }

  showTab(id: string) {
    this.rightTabId = id;
    this.focus(this.#bring("right"));
    this.commit();
  }

  newTab(categoryId: string | null = null, at: PaneRole = this.target) {
    const role = this.#bring(at);
    const tab = tabs.newTab(categoryId, role);
    if (role === "right") this.rightTabId = tab.id;
    this.commit();
    return tab;
  }

  openInRight(session: SessionInfo) {
    const environmentId = this.rightTab?.environmentId ?? this.focusedTab?.environmentId ?? null;
    const tab = tabs.openSessionTab(session, environmentId, "right");
    this.rightTabId = tab.id;
    this.focus(this.#bring("right"));
    this.commit();
    return tab;
  }

  openSession(session: SessionInfo, at: PaneRole = this.target) {
    const role = this.#bring(at);
    const tab = tabs.openSessionTab(session, this.focusedTab?.environmentId ?? null, role);
    if (role === "right") this.rightTabId = tab.id;
    this.commit();
    return tab;
  }

  closeFocused() {
    if (this.onTool) return false;
    if (this.focusedTab) this.close(this.focusedTab.id);
  }

  focus(role: PaneRole) {
    this.focused = role;
    paneFocus.set(SCOPE[this.busyRole === role ? this.viewAt(otherPane(role)) : this.viewAt(role)]);
    const environmentId =
      this.viewAt(role) === AGENTS ? agentTabs.activeIn(role)?.environmentId : this.focusedTab?.environmentId;
    if (environmentId && backend.activeId !== environmentId) backend.select(environmentId);
    tabs.rightFocused = this.focused === "right";
    tabs.rightActiveId = this.#shownRight();
    tabs.syncUrl();
  }

  commit() {
    tabs.rightActiveId = this.#shownRight();
    tabs.commit();
    if (!layout.mobile) this.#wideOpen = this.open;
    settings.rightPane = JSON.stringify({
      open: this.#wideOpen,
      kind: this.kind,
      center: this.centerKind,
      tab: Math.max(
        tabs.right.findIndex((tab) => tab.id === this.rightTabId),
        0,
      ),
    });
  }
}

export const panes = new Panes();
