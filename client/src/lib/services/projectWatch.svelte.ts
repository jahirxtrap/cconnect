import { backend, type Profile } from "./backend.svelte";
import { ReconnectingSocket } from "./socket";

export interface ProjectBurst {
  tick: number;
  paths: string[];
  truncated: boolean;
}

export class ProjectWatch {
  burst = $state<ProjectBurst>({ tick: 0, paths: [], truncated: true });

  #socket: ReconnectingSocket;
  #projectKey = "";

  constructor(profile: () => Profile = () => backend.active) {
    this.#socket = new ReconnectingSocket(
      "/projects/ws",
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

  watch(projectKey: string) {
    this.#projectKey = projectKey;
    this.#sendWatch();
  }

  refresh() {
    this.#publish([], true);
  }

  #sendWatch() {
    if (this.#projectKey) this.#socket.send({ type: "watch", project_key: this.#projectKey });
  }

  #apply(message: Record<string, unknown>) {
    if (message.type !== "changed") return;
    if ((message.project_key ?? "") !== this.#projectKey) return;
    const paths = message.paths;
    if (!Array.isArray(paths) || message.truncated === true) this.#publish([], true);
    else this.#publish(paths.map(String), false);
  }

  #publish(paths: string[], truncated: boolean) {
    this.burst = { tick: this.burst.tick + 1, paths, truncated };
  }
}
