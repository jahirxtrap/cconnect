import { toAgentSession, type AgentSession } from "$lib/data/agentModels";
import type { Profile } from "./backend.svelte";
import { ReconnectingSocket } from "./socket";

type Wire = Record<string, unknown>;

export class AgentSessionsWatch {
  sessions = $state<AgentSession[] | null>(null);
  failed = $state(false);

  #socket: ReconnectingSocket;
  #agent = "";
  #cwd = "";

  constructor(profile: () => Profile) {
    this.#socket = new ReconnectingSocket(
      "/agents/ws",
      {
        onOpen: () => this.#sendWatch(),
        onMessage: (message) => this.#apply(message),
      },
      profile,
    );
  }

  connect() {
    this.#socket.connect();
  }

  close() {
    this.#socket.close();
  }

  watch(agent: string, cwd: string) {
    this.#agent = agent;
    this.#cwd = cwd;
    this.sessions = null;
    this.failed = false;
    this.#sendWatch();
  }

  #sendWatch() {
    this.#socket.send({ type: "watch", agent: this.#agent, cwd: this.#cwd });
  }

  #apply(message: Wire) {
    if (message.type !== "sessions" || message.agent !== this.#agent || message.cwd !== this.#cwd) return;
    const listed = Array.isArray(message.sessions) ? (message.sessions as Wire[]) : null;
    this.failed = listed === null;
    this.sessions = listed?.flatMap((item) => toAgentSession(item) ?? []) ?? null;
  }
}
