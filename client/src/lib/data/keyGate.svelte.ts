import type { Profile } from "$lib/services/backend.svelte";
import { securityKeys } from "./securityKeys.svelte";
import { serverStatus } from "./serverStatus.svelte";

const FORBIDDEN = 403;

interface Answered {
  ok: boolean;
  status: number;
}

export const keyRefused = (result: Answered): boolean => result.status === FORBIDDEN;

/** Only for a route that answers nothing without the key, so its success proves the key and its 403 refuses it. */
export const judgeKey = (profile: Profile, key: string, result: Answered) => {
  if (result.ok || keyRefused(result)) securityKeys.judge(profile, key, result.ok);
};

export class KeyGate {
  asking = $state(false);
  rejected = $state(false);
  #answer: ((key: string | null) => void) | null = null;

  async run<R extends Answered>(attempt: (key: string) => Promise<R>): Promise<R> {
    let result = await attempt(securityKeys.current);
    if (result.status !== FORBIDDEN || !serverStatus.version?.gated) return result;
    this.rejected = securityKeys.current !== "";
    for (;;) {
      const key = await this.#ask();
      if (key === null) return result;
      result = await attempt(key);
      if (result.status !== FORBIDDEN) {
        if (result.ok) securityKeys.set(key);
        this.#close();
        return result;
      }
      this.rejected = true;
    }
  }

  confirm(key: string) {
    this.#answer?.(key);
  }

  dismiss() {
    const answer = this.#answer;
    this.#close();
    answer?.(null);
  }

  #ask(): Promise<string | null> {
    this.asking = true;
    return new Promise((resolve) => (this.#answer = resolve));
  }

  #close() {
    this.asking = false;
    this.rejected = false;
    this.#answer = null;
  }
}
