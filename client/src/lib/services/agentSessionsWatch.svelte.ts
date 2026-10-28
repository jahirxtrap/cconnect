import { toAgentSession, type AgentSession } from "$lib/data/agentModels";
import { profileKey, type Profile } from "./backend.svelte";
import { ReconnectingSocket } from "./socket";

type Wire = Record<string, unknown>;

export class AgentSessionsWatch {
  sessions = $state<AgentSession[] | null>(null);
  failed = $state(false);

  #socket: ReconnectingSocket;

  constructor(
    profile: Profile,
    private readonly agent: string,
    private readonly cwd: string,
  ) {
    this.#socket = new ReconnectingSocket(
      "/agents/ws",
      {
        onOpen: () => this.#socket.send({ type: "watch", agent: this.agent, cwd: this.cwd }),
        onMessage: (message) => this.#apply(message),
      },
      () => profile,
    );
    this.#socket.connect();
  }

  #apply(message: Wire) {
    if (message.agent !== this.agent || message.cwd !== this.cwd) return;
    if (message.type === "activity") {
      const activity = typeof message.activity === "string" ? message.activity : null;
      this.sessions =
        this.sessions?.map((session) => (session.sessionId === message.session_id ? { ...session, activity } : session)) ??
        null;
      return;
    }
    if (message.type !== "sessions") return;
    const listed = Array.isArray(message.sessions) ? (message.sessions as Wire[]) : null;
    this.failed = listed === null;
    this.sessions = listed?.flatMap((item) => toAgentSession(item) ?? []) ?? null;
  }
}

const watches = new Map<string, AgentSessionsWatch>();

export const agentSessionsFor = (profile: Profile, agent: string, cwd: string): AgentSessionsWatch => {
  const key = JSON.stringify([profileKey(profile), agent, cwd]);
  const existing = watches.get(key);
  if (existing) return existing;
  const created = new AgentSessionsWatch(profile, agent, cwd);
  watches.set(key, created);
  return created;
};
