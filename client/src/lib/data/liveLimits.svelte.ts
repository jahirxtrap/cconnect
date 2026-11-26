import type { LimitWindow } from "./usageWindows";

const SECOND_MS = 1000;

const keyOf = (environmentId: string | null, account: string) => `${environmentId ?? ""}:${account}`;

const resetOf = (window: LimitWindow) => (window.resetsAt === null ? Infinity : window.resetsAt * SECOND_MS);

class LiveLimits {
  #windows = $state<Record<string, LimitWindow[]>>({});
  #expiries = new Map<string, ReturnType<typeof setTimeout>>();

  of(environmentId: string | null, account: string): LimitWindow[] | null {
    return this.#windows[keyOf(environmentId, account)] ?? null;
  }

  set(environmentId: string | null, account: string, windows: LimitWindow[]) {
    const key = keyOf(environmentId, account);
    const current = windows.filter((window) => resetOf(window) > Date.now());
    this.#windows[key] = current;
    clearTimeout(this.#expiries.get(key));
    this.#expiries.delete(key);
    const next = Math.min(...current.map(resetOf));
    if (next !== Infinity) {
      this.#expiries.set(key, setTimeout(() => this.set(environmentId, account, current), next - Date.now()));
    }
  }
}

export const liveLimits = new LiveLimits();
