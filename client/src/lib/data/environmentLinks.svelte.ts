import { onWake } from "$lib/platform/wake";
import { backend, profileKey, type EnvironmentProfile } from "$lib/services/backend.svelte";
import { createCapabilitiesApi } from "$lib/services/capabilitiesApi";
import { createHttp } from "$lib/services/http";
import type { ConnectionState } from "./chatModels";
import { openChatList } from "./chatList.svelte";
import { serverStatus } from "./serverStatus.svelte";

class EnvironmentLinks {
  #known = $state<Record<string, ConnectionState>>({});
  #checked = new Map<string, string>();
  #wakes = 0;
  #listening = false;

  linkOf(environment: EnvironmentProfile): ConnectionState {
    if (environment.id === backend.active?.id) return serverStatus.link;
    if (openChatList(environment)?.connected) return "connected";
    return this.#known[environment.id] ?? "connecting";
  }

  check(environments: EnvironmentProfile[]) {
    this.#listen();
    for (const environment of environments) {
      if (environment.id === backend.active?.id || openChatList(environment)?.connected) continue;
      const stamp = `${profileKey(environment)}#${this.#wakes}`;
      if (this.#checked.get(environment.id) === stamp) continue;
      this.#checked.set(environment.id, stamp);
      void createCapabilitiesApi(createHttp(() => environment))
        .versionInfo()
        .then((version) => {
          this.#known = { ...this.#known, [environment.id]: version ? "connected" : "disconnected" };
        });
    }
  }

  #listen() {
    if (this.#listening) return;
    this.#listening = true;
    onWake(() => this.#wakes++);
  }
}

export const environmentLinks = new EnvironmentLinks();
