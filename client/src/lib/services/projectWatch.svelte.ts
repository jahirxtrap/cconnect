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
  #folders: string[] = [];
  #sent = "";
  #dropped = false;

  constructor(profile: () => Profile = () => backend.active) {
    this.#socket = new ReconnectingSocket(
      "/projects/ws",
      {
        onOpen: () => this.#resume(),
        onMessage: (message) => this.#apply(message),
        onDrop: () => (this.#dropped = true),
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

  watch(projectKey: string, folders: string[]) {
    this.#projectKey = projectKey;
    this.#folders = folders;
    this.#sendWatch();
  }

  refresh() {
    this.#publish([], true);
  }

  #resume() {
    this.#sent = "";
    this.#sendWatch();
    if (this.#dropped) this.refresh();
    this.#dropped = false;
  }

  #sendWatch() {
    if (!this.#projectKey) return;
    const message = { type: "watch", project_key: this.#projectKey, folders: this.#folders };
    const wire = JSON.stringify(message);
    if (wire === this.#sent) return;
    this.#sent = wire;
    this.#socket.send(message);
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
