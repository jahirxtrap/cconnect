import { secureStore } from "$lib/platform/secureStorage";
import { backend, baseUrlOf, type Profile } from "$lib/services/backend.svelte";

const KEY = "security.keys";
const HEADER = "X-Security-Key";

const verdictSlot = (url: string, key: string) => `${url}\n${key}`;

class SecurityKeys {
  #keys = $state<Record<string, string>>(secureStore.get(KEY, {}));
  #verdicts = $state<Record<string, boolean>>({});

  readonly current = $derived(this.#keys[backend.baseUrl] ?? "");

  unlocked(profile: Profile): boolean | null {
    const url = baseUrlOf(profile);
    return url ? (this.#verdicts[verdictSlot(url, this.#keys[url] ?? "")] ?? null) : null;
  }

  judge(profile: Profile, key: string, unlocked: boolean) {
    const url = baseUrlOf(profile);
    if (!url) return;
    const slot = verdictSlot(url, key);
    if (this.#verdicts[slot] !== unlocked) this.#verdicts = { ...this.#verdicts, [slot]: unlocked };
  }

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

  headers(key: string): Record<string, string> {
    return key ? { [HEADER]: key } : {};
  }

  headersFor(profile: Profile): Record<string, string> {
    return this.headers(this.keyFor(profile));
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

export const securityKeys = new SecurityKeys();
