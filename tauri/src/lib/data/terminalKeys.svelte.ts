import { secureStore } from "$lib/platform/secureStorage";
import { backend, baseUrlOf, type Profile } from "$lib/services/backend.svelte";

const KEY = "terminal.keys";

class TerminalKeys {
  #keys = $state<Record<string, string>>(secureStore.get(KEY, {}));

  readonly current = $derived(this.#keys[backend.baseUrl] ?? "");

  set(value: string) {
    if (!backend.baseUrl) return;
    this.#save({ ...this.#keys, [backend.baseUrl]: value.trim() });
  }

  keyFor(profile: Profile) {
    const url = baseUrlOf(profile);
    return url ? (this.#keys[url] ?? "") : "";
  }

  setFor(profile: Profile, value: string) {
    const url = baseUrlOf(profile);
    if (!url) return;
    this.#save({ ...this.#keys, [url]: value.trim() });
  }

  forget() {
    const rest = { ...this.#keys };
    delete rest[backend.baseUrl];
    this.#save(rest);
  }

  #save(keys: Record<string, string>) {
    this.#keys = keys;
    secureStore.set(KEY, keys);
  }
}

export const terminalKeys = new TerminalKeys();
