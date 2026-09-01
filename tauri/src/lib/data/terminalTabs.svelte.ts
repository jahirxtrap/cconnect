import { backend } from "$lib/services/backend.svelte";
import {
  closeTerminal,
  listTerminals,
  openTerminal,
  type PtyInfo,
  type TerminalInfo,
} from "$lib/services/terminalApi";
import { localLink } from "$lib/services/terminalSocket";
import { settings } from "./settings.svelte";
import { terminalKeys } from "./terminalKeys.svelte";
import type { TerminalConnector } from "./terminalLink";

export interface TerminalTab {
  id: string;
  title: string;
  local: boolean;
  pty?: PtyInfo | null;
}

interface EnvironmentTabs {
  items: TerminalTab[];
  activeId: string | null;
}

const NEW_COLS = 80;
const NEW_ROWS = 24;

const connectors = new Map<string, TerminalConnector>();

const empty = (): EnvironmentTabs => ({ items: [], activeId: null });

class TerminalTabs {
  panelOpen = $state(settings.terminalOpen);
  overlayOpen = $state(false);

  #byEnvironment = $state<Record<string, EnvironmentTabs>>({});

  readonly environment = $derived(backend.active?.id ?? "");
  readonly items = $derived(this.#byEnvironment[this.environment]?.items ?? []);
  readonly activeId = $derived(this.#byEnvironment[this.environment]?.activeId ?? null);

  setPanelOpen(open: boolean) {
    this.panelOpen = open;
    settings.terminalOpen = open;
  }

  connectorOf(id: string) {
    return connectors.get(this.#key(id)) ?? null;
  }

  open(tab: TerminalTab, connect: TerminalConnector) {
    const key = this.#key(tab.id);
    if (!connectors.has(key)) connectors.set(key, connect);
    const current = this.#current();
    const items = current.items.some((item) => item.id === tab.id)
      ? current.items
      : [...current.items, tab];
    this.#write({ items, activeId: tab.id });
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
    const alive = new Set(sessions.filter((session) => session.alive).map((session) => session.id));
    const current = this.#current();
    const kept = current.items.filter((tab) => !tab.local || alive.has(tab.id));
    const known = new Set(kept.map((tab) => tab.id));
    for (const session of sessions) {
      if (!session.alive || known.has(session.id)) continue;
      kept.push({ id: session.id, title: session.title, local: true, pty: session.pty });
      connectors.set(this.#key(session.id), (hooks, cols, rows) =>
        localLink(session.id, terminalKeys.current, hooks, cols, rows),
      );
    }
    const activeId = kept.some((tab) => tab.id === current.activeId)
      ? current.activeId
      : (kept[0]?.id ?? null);
    if (kept.length === current.items.length && activeId === current.activeId) return;
    this.#write({ items: kept, activeId });
  }

  select(id: string) {
    this.#write({ ...this.#current(), activeId: id });
  }

  selectNext() {
    this.#step(1);
  }

  selectPrev() {
    this.#step(-1);
  }

  move(id: string, index: number) {
    const current = this.#current();
    const from = current.items.findIndex((tab) => tab.id === id);
    if (from < 0 || index < 0 || index >= current.items.length) return;
    const items = [...current.items];
    items.splice(index, 0, ...items.splice(from, 1));
    this.#write({ ...current, items });
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
    const current = this.#current();
    const index = current.items.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    connectors.delete(this.#key(id));
    const items = current.items.filter((tab) => tab.id !== id);
    const activeId =
      current.activeId === id ? (items[Math.min(index, items.length - 1)]?.id ?? null) : current.activeId;
    this.#write({ items, activeId });
  }

  #key(id: string) {
    return `${this.environment}:${id}`;
  }

  #current() {
    return this.#byEnvironment[this.environment] ?? empty();
  }

  #write(value: EnvironmentTabs) {
    this.#byEnvironment = { ...this.#byEnvironment, [this.environment]: value };
  }

  #step(delta: number) {
    const current = this.#current();
    if (current.items.length < 2) return;
    const from = current.items.findIndex((tab) => tab.id === current.activeId);
    const next = (from + delta + current.items.length) % current.items.length;
    this.#write({ ...current, activeId: current.items[next].id });
  }
}

export const terminalTabs = new TerminalTabs();
