import { backend, type Profile } from "./backend.svelte";
import { parseEntry, type SharedEntry } from "./sharedApi";
import { ReconnectingSocket } from "./socket";

export class SharedWatch {
  entries = $state<SharedEntry[] | null>(null);

  #socket: ReconnectingSocket;
  #path = "";

  constructor(profile: () => Profile = () => backend.active) {
    this.#socket = new ReconnectingSocket(
      "/shared/ws",
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

  watch(path: string) {
    this.#path = path;
    this.entries = null;
    this.#sendWatch();
  }

  refresh() {
    this.#sendWatch();
  }

  #sendWatch() {
    this.#socket.send({ type: "watch", path: this.#path });
  }

  #apply(message: Record<string, unknown>) {
    if (message.type !== "snapshot") return;
    if ((message.path ?? "") !== this.#path) return;
    this.entries = ((message.entries as Record<string, unknown>[]) ?? []).map(parseEntry);
  }
}
