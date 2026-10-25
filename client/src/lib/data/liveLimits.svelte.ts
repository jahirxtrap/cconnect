import type { LimitWindow } from "./usageWindows";

const keyOf = (environmentId: string | null, account: string) => `${environmentId ?? ""}:${account}`;

class LiveLimits {
  #windows = $state<Record<string, LimitWindow[]>>({});

  of(environmentId: string | null, account: string): LimitWindow[] | null {
    return this.#windows[keyOf(environmentId, account)] ?? null;
  }

  set(environmentId: string | null, account: string, windows: LimitWindow[]) {
    this.#windows[keyOf(environmentId, account)] = windows;
  }
}

export const liveLimits = new LiveLimits();
