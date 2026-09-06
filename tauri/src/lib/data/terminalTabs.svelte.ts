import { backend } from "$lib/services/backend.svelte";
import {
  closeTerminal,
  listTerminals,
  openTerminal,
  type PtyInfo,
  type TerminalInfo,
} from "$lib/services/terminalApi";
import { localLink } from "$lib/services/terminalSocket";
import { terminalKeys } from "./terminalKeys.svelte";
import type { TerminalConnector } from "./terminalLink";

export interface TerminalTab {
  id: string;
  title: string;
  local: boolean;
  pty?: PtyInfo | null;
  environment: string | null;
}

const NEW_COLS = 80;
const NEW_ROWS = 24;

const connectors = new Map<string, TerminalConnector>();

class TerminalTabs {
  overlayOpen = $state(false);

  #items = $state<TerminalTab[]>([]);
  #activeId = $state<string | null>(null);

  readonly environment = $derived(backend.active?.id ?? "");
  readonly items = $derived(this.#items.filter((tab) => this.#reachable(tab)));
  readonly activeId = $derived(
    this.items.some((tab) => tab.id === this.#activeId) ? this.#activeId : (this.items[0]?.id ?? null),
  );

  connectorOf(id: string) {
    const tab = this.#find(id);
    return tab ? (connectors.get(this.#key(tab)) ?? null) : null;
  }

  open(tab: Omit<TerminalTab, "environment">, connect: TerminalConnector) {
    const opened = { ...tab, environment: tab.local ? this.environment : null };
    const key = this.#key(opened);
    if (!connectors.has(key)) connectors.set(key, connect);
    if (!this.#find(opened.id)) this.#items = [...this.#items, opened];
    this.#activeId = opened.id;
  }

  openLocal(session: TerminalInfo) {
    const key = terminalKeys.current;
    this.open(
      { id: session.id, title: session.title, local: true, pty: session.pty },
      (hooks, cols, rows) => localLink(session.id, key, hooks, cols, rows),
    );
  }

  async create(cwd: string[]) {
    const created = await openTerminal({ cwd, cols: NEW_COLS, rows: NEW_ROWS });
    if (created) this.openLocal(created);
    return created;
  }

  sync(sessions: TerminalInfo[]) {
    const environment = this.environment;
    const alive = new Set(sessions.filter((session) => session.alive).map((session) => session.id));
    const kept = this.#items.filter(
      (tab) => !tab.local || tab.environment !== environment || alive.has(tab.id),
    );
    const known = new Set(kept.filter((tab) => tab.environment === environment).map((tab) => tab.id));
    for (const session of sessions) {
      if (!session.alive || known.has(session.id)) continue;
      const tab = { id: session.id, title: session.title, local: true, pty: session.pty, environment };
      kept.push(tab);
      connectors.set(this.#key(tab), (hooks, cols, rows) =>
        localLink(session.id, terminalKeys.current, hooks, cols, rows),
      );
    }
    if (kept.length === this.#items.length) return;
    this.#items = kept;
  }

  select(id: string) {
    this.#activeId = id;
  }

  selectNext() {
    this.#step(1);
  }

  selectPrev() {
    this.#step(-1);
  }

  move(id: string, index: number) {
    const shown = this.items;
    const from = shown.findIndex((tab) => tab.id === id);
    if (from < 0 || index < 0 || index >= shown.length) return;
    const reordered = [...shown];
    reordered.splice(index, 0, ...reordered.splice(from, 1));
    this.#items = [...this.#items.filter((tab) => !this.#reachable(tab)), ...reordered];
  }

  has(id: string) {
    return this.items.some((tab) => tab.id === id);
  }

  async needsConfirm(tab: TerminalTab) {
    if (!tab.local) return false;
    const listed = await listTerminals();
    return listed?.find((session) => session.id === tab.id)?.busy ?? false;
  }

  async drop(tab: TerminalTab) {
    this.close(tab.id);
    if (tab.local) await closeTerminal(tab.id);
  }

  close(id: string) {
    const tab = this.#find(id);
    if (!tab) return;
    const index = this.items.indexOf(tab);
    connectors.delete(this.#key(tab));
    this.#items = this.#items.filter((item) => item !== tab);
    if (this.#activeId !== id) return;
    const shown = this.items;
    this.#activeId = shown[Math.min(index, shown.length - 1)]?.id ?? null;
  }

  #reachable(tab: TerminalTab) {
    return tab.environment === null || tab.environment === this.environment;
  }

  #find(id: string) {
    return this.items.find((tab) => tab.id === id) ?? null;
  }

  #key(tab: TerminalTab) {
    return tab.environment === null ? tab.id : `${tab.environment}:${tab.id}`;
  }

  #step(delta: number) {
    const shown = this.items;
    if (shown.length < 2) return;
    const from = shown.findIndex((tab) => tab.id === this.activeId);
    this.#activeId = shown[(from + delta + shown.length) % shown.length].id;
  }
}

export const terminalTabs = new TerminalTabs();
