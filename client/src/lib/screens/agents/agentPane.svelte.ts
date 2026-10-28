import { untrack } from "svelte";
import { settings } from "$lib/data/settings.svelte";
import { panelProject } from "$lib/screens/chat/panelProject.svelte";
import { ChatState } from "$lib/screens/chat/state.svelte";
import { tabs } from "$lib/screens/chat/tabs.svelte";

interface Kept {
  session: string;
  cwd: string;
}

interface Stored {
  agent?: string;
  kept?: Record<string, Kept>;
}

interface Held {
  chat: ChatState;
  stop: () => void;
}

const stored = (): Stored => {
  try {
    return JSON.parse(settings.agentPane || "{}") as Stored;
  } catch {
    return {};
  }
};

const keyOf = (environmentId: string | null, agent: string) => `${environmentId ?? ""}/${agent}`;

const followedFolder = (): string | null => (panelProject.settled ? (panelProject.path ?? tabs.state.cwd) : null);

class AgentPane {
  agent = $state<string | null>(stored().agent ?? null);

  #kept: Record<string, Kept> = stored().kept ?? {};
  #held = new Map<string, Held>();

  select(agent: string) {
    this.agent = agent;
    this.#save();
  }

  restart(chat: ChatState) {
    const key = [...this.#held].find(([, held]) => held.chat === chat)?.[0];
    if (key && this.#kept[key]) {
      this.#kept = Object.fromEntries(Object.entries(this.#kept).filter(([name]) => name !== key));
      this.#save();
    }
    chat.startAgentSession(followedFolder() ?? chat.cwd);
  }

  syncVisibility() {
    for (const { chat } of this.#held.values()) chat.syncVisibility();
  }

  stateFor(environmentId: string | null, agent: string): ChatState {
    const key = keyOf(environmentId, agent);
    const existing = this.#held.get(key);
    if (existing) return existing.chat;
    const kept = this.#kept[key];
    let created!: ChatState;
    const stop = $effect.root(() => {
      created = new ChatState({
        environmentId,
        sessionId: kept?.session ?? null,
        projectKey: null,
        cwd: kept?.cwd ?? followedFolder() ?? tabs.state.cwd,
        agent,
      });
      $effect(() => {
        const session = created.sessionId;
        const cwd = created.cwd;
        const talked = created.messages.length > 0;
        if (session && talked) untrack(() => this.#keep(key, session, cwd));
      });
      $effect(() => {
        const folder = followedFolder();
        untrack(() => {
          const blank = !created.messages.length && !created.streaming && !created.transcriptLoading;
          if (blank && folder && folder !== created.cwd) created.startAgentSession(folder);
        });
      });
    });
    this.#held.set(key, { chat: created, stop });
    return created;
  }

  keepOnly(chat: ChatState) {
    for (const [key, held] of this.#held) {
      if (held.chat === chat) continue;
      this.#held.delete(key);
      held.stop();
      held.chat.dispose();
    }
  }

  #keep(key: string, session: string, cwd: string) {
    const kept = this.#kept[key];
    if (kept?.session === session && kept.cwd === cwd) return;
    this.#kept = { ...this.#kept, [key]: { session, cwd } };
    this.#save();
  }

  #save() {
    settings.agentPane = JSON.stringify({ agent: this.agent, kept: this.#kept });
  }
}

export const agentPane = new AgentPane();
