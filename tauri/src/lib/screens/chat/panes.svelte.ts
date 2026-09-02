import type { SessionInfo } from "$lib/data/models";
import { paneFocus, type Pane } from "$lib/data/paneFocus.svelte";
import { settings } from "$lib/data/settings.svelte";
import { backend } from "$lib/services/backend.svelte";
import { readFocusedPane, readRightLocation, tabs, type PaneRole } from "./tabs.svelte";

export type RightKind = "terminal" | "chat" | "markdown" | "monitor" | "claude" | "files";

const KINDS: RightKind[] = ["terminal", "chat", "markdown", "monitor", "claude", "files"];

const SCOPE: Record<RightKind, Pane> = {
  terminal: "terminal",
  chat: "chat",
  markdown: "chat",
  monitor: "chat",
  claude: "chat",
  files: "files",
};

interface StoredRight {
  open?: boolean;
  kind?: RightKind;
  tab?: number;
}

class Panes {
  open = $state(false);
  kind = $state<RightKind>("terminal");
  rightTabId = $state<string | null>(null);
  focused = $state<PaneRole>("center");
  dropTarget = $state<PaneRole | null>(null);

  readonly rightTab = $derived(
    this.kind === "chat"
      ? (tabs.right.find((tab) => tab.id === this.rightTabId) ?? tabs.right[0] ?? null)
      : null,
  );

  readonly target = $derived<PaneRole>(
    this.open && this.focused === "right" && this.kind === "chat" ? "right" : "center",
  );

  readonly focusedTab = $derived(
    this.target === "right" && this.rightTab ? this.rightTab : tabs.active,
  );

  constructor() {
    try {
      const stored = JSON.parse(settings.rightPane || "{}") as StoredRight;
      this.kind = stored.kind && KINDS.includes(stored.kind) ? stored.kind : "terminal";
      this.open = stored.open === true;
      this.rightTabId = tabs.right[stored.tab ?? 0]?.id ?? tabs.right[0]?.id ?? null;
    } catch {
      this.rightTabId = tabs.right[0]?.id ?? null;
    }

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
      this.kind = "chat";
      this.open = true;
    }
    tabs.rightActiveId = this.rightTabId;
    tabs.rightFocused = this.target === "right";
  }

  swap() {
    if (this.kind !== "chat") return;
    const active = tabs.activeId;
    tabs.swapPanes();
    tabs.activeId = this.rightTabId ?? tabs.center[0]?.id ?? active;
    this.rightTabId = active;
    this.focus(this.focused === "right" ? "center" : "right");
  }

  setOpen(open: boolean) {
    this.open = open;
    if (open && this.kind === "chat" && !this.rightTab) {
      this.rightTabId = tabs.newTab(null, "right").id;
    }
    this.focus(open ? "right" : "center");
    this.commit();
  }

  setKind(kind: RightKind) {
    this.kind = kind;
    if (kind === "chat" && !this.rightTab) this.rightTabId = tabs.newTab(null, "right").id;
    this.focus("right");
    this.commit();
  }

  selectSibling(delta: number) {
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
    if (this.kind === "chat" && !tabs.right.length) this.rightTabId = tabs.newTab(null, "right").id;
    this.commit();
  }

  reveal(id: string) {
    const tab = tabs.list.find((item) => item.id === id);
    if (!tab) return;
    if (tab.pane === "right") {
      this.open = true;
      this.showTab(id);
      return;
    }
    tabs.select(id);
    this.focus("center");
  }

  showTab(id: string) {
    this.kind = "chat";
    this.rightTabId = id;
    this.focus("right");
    this.commit();
  }

  newTab(categoryId: string | null = null) {
    const tab = tabs.newTab(categoryId, this.target);
    if (this.target === "right") this.rightTabId = tab.id;
    this.commit();
    return tab;
  }

  openInRight(session: SessionInfo) {
    const environmentId = this.rightTab?.environmentId ?? this.focusedTab?.environmentId ?? null;
    const tab = tabs.openSessionTab(session, environmentId, "right");
    this.open = true;
    this.kind = "chat";
    this.rightTabId = tab.id;
    this.focus("right");
    this.commit();
    return tab;
  }

  openSession(session: SessionInfo) {
    const tab = tabs.openSessionTab(session, this.focusedTab?.environmentId ?? null, this.target);
    if (this.target === "right") this.rightTabId = tab.id;
    this.commit();
    return tab;
  }

  closeFocused() {
    if (this.focusedTab) this.close(this.focusedTab.id);
  }

  focus(role: PaneRole) {
    this.focused = role;
    paneFocus.set(role === "right" ? SCOPE[this.kind] : "chat");
    const environmentId = this.focusedTab?.environmentId;
    if (environmentId && backend.activeId !== environmentId) backend.select(environmentId);
    tabs.rightFocused = this.target === "right";
    tabs.rightActiveId = this.rightTab?.id ?? null;
    tabs.syncUrl();
  }

  commit() {
    tabs.rightActiveId = this.rightTab?.id ?? null;
    tabs.commit();
    settings.rightPane = JSON.stringify({
      open: this.open,
      kind: this.kind,
      tab: Math.max(
        tabs.right.findIndex((tab) => tab.id === this.rightTabId),
        0,
      ),
    });
  }
}

export const panes = new Panes();
