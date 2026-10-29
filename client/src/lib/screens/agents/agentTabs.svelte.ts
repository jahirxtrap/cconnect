import { untrack } from "svelte";
import { settings } from "$lib/data/settings.svelte";
import { ChatState } from "$lib/screens/chat/state.svelte";
import type { PaneRole } from "$lib/screens/chat/tabs.svelte";
import { agents } from "$lib/services/agents.svelte";
import { backend } from "$lib/services/backend.svelte";

export interface AgentTab {
  id: string;
  pane: PaneRole;
  environmentId: string | null;
  agent: string;
  sessionId: string | null;
  cwd: string;
  title: string | null;
  panelProject: string | null;
}

interface StoredTab {
  env?: string;
  agent?: string;
  sid?: string;
  cwd?: string;
  title?: string;
  side?: boolean;
  pproj?: string;
}

interface Stored {
  tabs?: StoredTab[];
  active?: Partial<Record<PaneRole, number>>;
  agent?: string;
  folders?: Record<string, string>;
  kept?: Record<string, { session?: string; cwd?: string }>;
}

interface Held {
  chat: ChatState;
  stop: () => void;
}

const PANES: PaneRole[] = ["center", "right"];

const stored = (): Stored => {
  try {
    return JSON.parse(settings.agentPane || "{}") as Stored;
  } catch {
    return {};
  }
};

const profileOf = (environmentId: string | null) => backend.find(environmentId) ?? backend.active;

class AgentTabs {
  list = $state<AgentTab[]>([]);
  active = $state<Record<PaneRole, string | null>>({ center: null, right: null });

  #lastAgent: string | null = null;
  #folders: Record<string, string> = {};
  #counter = 0;
  #held = new Map<string, Held>();

  constructor() {
    const saved = stored();
    this.#lastAgent = saved.agent ?? null;
    this.#folders = saved.folders ?? {};
    if (saved.tabs) {
      this.list = saved.tabs.flatMap((item) =>
        item.agent
          ? [
              {
                id: this.#nextId(),
                pane: (item.side ? "right" : "center") as PaneRole,
                environmentId: item.env ?? null,
                agent: item.agent,
                sessionId: item.sid ?? null,
                cwd: item.cwd ?? "",
                title: item.title ?? null,
                panelProject: item.pproj ?? null,
              },
            ]
          : [],
      );
    } else if (saved.kept) {
      this.list = Object.entries(saved.kept).flatMap(([key, kept]) => {
        const cut = key.lastIndexOf("/");
        const agent = key.slice(cut + 1);
        if (!agent || !kept.session) return [];
        return [
          {
            id: this.#nextId(),
            pane: "right" as PaneRole,
            environmentId: key.slice(0, cut) || null,
            agent,
            sessionId: kept.session,
            cwd: kept.cwd ?? "",
            title: null,
            panelProject: null,
          },
        ];
      });
    }
    for (const pane of PANES) {
      const group = this.in(pane);
      this.active[pane] = group[Math.min(saved.active?.[pane] ?? 0, group.length - 1)]?.id ?? null;
    }
  }

  in(pane: PaneRole): AgentTab[] {
    return this.list.filter((tab) => tab.pane === pane);
  }

  activeIn(pane: PaneRole): AgentTab | null {
    const group = this.in(pane);
    return group.find((tab) => tab.id === this.active[pane]) ?? group[0] ?? null;
  }

  iconOf(id: string): string | null {
    const tab = this.list.find((item) => item.id === id);
    return tab ? agents.iconOf(profileOf(tab.environmentId), tab.agent) : null;
  }

  tabOf(chat: ChatState): AgentTab | null {
    const id = [...this.#held].find(([, held]) => held.chat === chat)?.[0];
    return this.list.find((tab) => tab.id === id) ?? null;
  }

  ensure(pane: PaneRole) {
    if (this.in(pane).length) return;
    const environmentId = backend.activeId;
    const usable = agents.usable(profileOf(environmentId));
    const agent = usable.find((item) => item.id === this.#lastAgent) ?? usable[0];
    if (agent) this.open(pane, environmentId, agent.id);
  }

  open(
    pane: PaneRole,
    environmentId: string | null,
    agent: string,
    sessionId: string | null = null,
    cwd = this.#folders[environmentId ?? ""] ?? "",
  ): AgentTab {
    const panelProject = this.activeIn(pane)?.panelProject ?? null;
    const tab: AgentTab = { id: this.#nextId(), pane, environmentId, agent, sessionId, cwd, title: null, panelProject };
    this.list = [...this.list, tab];
    this.active[pane] = tab.id;
    this.#lastAgent = agent;
    this.#persist();
    return tab;
  }

  newChat(pane: PaneRole) {
    const current = this.activeIn(pane);
    if (!current) {
      this.ensure(pane);
      return;
    }
    const held = this.#held.get(current.id)?.chat;
    this.open(pane, current.environmentId, current.agent, null, held ? this.folderOf(held) : current.cwd);
  }

  load(tab: AgentTab, sessionId: string, cwd: string) {
    this.select(tab.pane, tab.id);
    this.stateFor(tab).openAgentSession(sessionId, cwd);
  }

  openSession(pane: PaneRole, from: AgentTab, sessionId: string, cwd: string) {
    this.open(pane, from.environmentId, from.agent, sessionId, cwd);
  }

  select(pane: PaneRole, id: string) {
    this.active[pane] = id;
    this.#lastAgent = this.list.find((tab) => tab.id === id)?.agent ?? this.#lastAgent;
    this.#persist();
  }

  close(id: string) {
    const tab = this.list.find((item) => item.id === id);
    if (!tab) return;
    const group = this.in(tab.pane);
    const index = group.findIndex((item) => item.id === id);
    this.#release(id);
    this.list = this.list.filter((item) => item.id !== id);
    if (this.active[tab.pane] === id) {
      const rest = this.in(tab.pane);
      this.active[tab.pane] = rest[Math.min(index, rest.length - 1)]?.id ?? null;
    }
    this.#persist();
  }

  move(id: string, toIndex: number) {
    const tab = this.list.find((item) => item.id === id);
    if (!tab) return;
    const group = this.in(tab.pane);
    const from = group.findIndex((item) => item.id === id);
    const to = Math.min(Math.max(toIndex, 0), group.length - 1);
    if (from < 0 || from === to) return;
    const [moved] = group.splice(from, 1);
    group.splice(to, 0, moved);
    this.list = [...this.list.filter((item) => item.pane !== tab.pane), ...group];
    this.#persist();
  }

  moveToPane(id: string, pane: PaneRole) {
    const tab = this.list.find((item) => item.id === id);
    if (!tab || tab.pane === pane) return;
    const from = tab.pane;
    this.list = [...this.list.filter((item) => item.id !== id), { ...tab, pane }];
    this.active[pane] = id;
    if (this.active[from] === id) this.active[from] = this.in(from)[0]?.id ?? null;
    this.#persist();
  }

  swapPanes() {
    this.list = this.list.map((tab) => ({ ...tab, pane: tab.pane === "center" ? "right" : "center" }));
    this.active = { center: this.active.right, right: this.active.center };
    this.#persist();
  }

  setEnvironment(tab: AgentTab, environmentId: string) {
    if (tab.environmentId === environmentId) return;
    const usable = agents.usable(profileOf(environmentId));
    const agent = usable.find((item) => item.id === tab.agent) ?? usable.find((item) => item.id === this.#lastAgent) ?? usable[0];
    this.#replace(tab, { environmentId, agent: agent?.id ?? tab.agent, cwd: this.#folders[environmentId] ?? "" });
  }

  setAgent(tab: AgentTab, agent: string) {
    this.#lastAgent = agent;
    if (tab.agent === agent) return;
    const chat = this.#held.get(tab.id)?.chat;
    if (chat && !chat.untouched) {
      this.open(tab.pane, tab.environmentId, agent, null, this.folderOf(chat));
      return;
    }
    this.#replace(tab, { agent });
  }

  setPanelProject(id: string, projectKey: string | null) {
    this.#update(id, { panelProject: projectKey });
  }

  folderOf(chat: ChatState): string {
    return chat.historyPath ?? chat.cwd;
  }

  selectProject(chat: ChatState, projectKey: string | null) {
    chat.historyProjectKey = projectKey;
    const folder = chat.historyPath ?? chat.defaultCwd;
    if (!folder) return;
    this.#folders[chat.environmentId ?? ""] = folder;
    this.#persist();
    if (chat.untouched) this.restart(chat, folder);
  }

  restart(chat: ChatState, folder = this.folderOf(chat)) {
    if (chat.untouched && chat.cwd === folder) return;
    const tab = this.tabOf(chat);
    if (tab) this.#update(tab.id, { sessionId: null, title: null });
    chat.startAgentSession(folder);
  }

  syncVisibility() {
    for (const { chat } of this.#held.values()) chat.syncVisibility();
  }

  usableState(tab: AgentTab | null): ChatState | null {
    if (!tab) return null;
    return agents.usable(profileOf(tab.environmentId)).some((item) => item.id === tab.agent) ? this.stateFor(tab) : null;
  }

  stateFor(tab: AgentTab): ChatState {
    const existing = this.#held.get(tab.id);
    if (existing) return existing.chat;
    let created!: ChatState;
    const stop = $effect.root(() => {
      created = new ChatState({
        environmentId: tab.environmentId,
        sessionId: tab.sessionId,
        projectKey: null,
        cwd: tab.cwd,
        agent: tab.agent,
      });
      $effect(() => {
        const cwd = created.cwd;
        untrack(() => this.#keepFolder(tab.id, created.environmentId, cwd));
      });
      $effect(() => {
        const session = created.sessionId;
        const title = created.agentTitle;
        const talked = created.messages.length > 0;
        if (session && talked) untrack(() => this.#update(tab.id, { sessionId: session, title }));
      });
    });
    this.#held.set(tab.id, { chat: created, stop });
    return created;
  }

  #replace(tab: AgentTab, patch: Partial<AgentTab>) {
    this.#release(tab.id);
    this.#update(tab.id, { ...patch, sessionId: null, title: null });
  }

  #release(id: string) {
    const held = this.#held.get(id);
    if (!held) return;
    this.#held.delete(id);
    held.stop();
    held.chat.dispose();
  }

  #keepFolder(id: string, environmentId: string | null, cwd: string) {
    if (!cwd) return;
    this.#folders[environmentId ?? ""] = cwd;
    this.#update(id, { cwd });
    this.#persist();
  }

  #update(id: string, patch: Partial<AgentTab>) {
    const current = this.list.find((tab) => tab.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    if ((Object.keys(patch) as (keyof AgentTab)[]).every((key) => current[key] === next[key])) return;
    this.list = this.list.map((tab) => (tab.id === id ? next : tab));
    this.#persist();
  }

  #nextId() {
    return `agent${this.#counter++}`;
  }

  #persist() {
    const index = (pane: PaneRole) => Math.max(this.in(pane).findIndex((tab) => tab.id === this.active[pane]), 0);
    settings.agentPane = JSON.stringify({
      agent: this.#lastAgent,
      folders: this.#folders,
      active: { center: index("center"), right: index("right") },
      tabs: this.list.map((tab) => ({
        ...(tab.environmentId ? { env: tab.environmentId } : {}),
        agent: tab.agent,
        ...(tab.sessionId ? { sid: tab.sessionId } : {}),
        ...(tab.cwd ? { cwd: tab.cwd } : {}),
        ...(tab.title ? { title: tab.title } : {}),
        ...(tab.pane === "right" ? { side: true } : {}),
        ...(tab.panelProject === null ? {} : { pproj: tab.panelProject }),
      })),
    });
  }
}

export const agentTabs = new AgentTabs();
