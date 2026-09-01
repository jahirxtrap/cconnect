import { isTauri } from "./index";
import { store } from "./storage";

// Mirrors the Compose client, which keeps environments and SSH hosts encrypted
// (DPAPI on Windows) and in plain text everywhere else.
const PREFIX = "enc:v1:";

class SecureStore {
  #values = new Map<string, unknown>();
  #available = false;

  async load(keys: string[]) {
    if (isTauri) {
      const { invoke } = await import("@tauri-apps/api/core");
      this.#available = await invoke<boolean>("secret_available").catch(() => false);
      for (const key of keys) {
        const raw = store.get<unknown>(key, null);
        if (typeof raw === "string" && raw.startsWith(PREFIX)) {
          const plain = await invoke<string | null>("secret_unprotect", { value: raw.slice(PREFIX.length) }).catch(
            () => null,
          );
          this.#values.set(key, plain === null ? null : this.#parse(plain));
          continue;
        }
        // Written before encryption existed: keep it and store it protected.
        this.#values.set(key, raw);
        if (raw !== null) void this.#persist(key, raw);
      }
      return;
    }
    for (const key of keys) this.#values.set(key, store.get<unknown>(key, null));
  }

  get<T>(key: string, fallback: T): T {
    const value = this.#values.get(key);
    return value === undefined || value === null ? fallback : (value as T);
  }

  set<T>(key: string, value: T) {
    this.#values.set(key, value);
    void this.#persist(key, value);
  }

  async #persist(key: string, value: unknown) {
    if (!this.#available) {
      store.set(key, value);
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const sealed = await invoke<string | null>("secret_protect", { value: JSON.stringify(value) }).catch(() => null);
    if (sealed === null) store.set(key, value);
    else store.set(key, `${PREFIX}${sealed}`);
  }

  #parse(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

export const secureStore = new SecureStore();

export const SECURE_KEYS = ["environments", "ssh.profiles", "terminal.keys"];
