import { profileKey, type Profile } from "$lib/services/backend.svelte";
import type { PluginFinished, PluginUpdate } from "$lib/services/claudeApi";

export interface PluginsFinished {
  count: number;
  held: boolean;
}

const NONE: PluginsFinished = { count: 0, held: false };

class PluginUpdates {
  #byProfile = $state<Record<string, Record<string, PluginUpdate>>>({});
  #finished = $state<Record<string, PluginsFinished>>({});

  of(profile: Profile | null): Record<string, PluginUpdate> {
    return profile ? (this.#byProfile[profileKey(profile)] ?? {}) : {};
  }

  finishedOf(profile: Profile | null): PluginsFinished {
    return profile ? (this.#finished[profileKey(profile)] ?? NONE) : NONE;
  }

  adopt(profile: Profile, updates: Record<string, PluginUpdate>, finished: PluginFinished[] = []) {
    const key = profileKey(profile);
    this.#byProfile[key] = updates;
    if (finished.length) {
      const before = this.#finished[key] ?? NONE;
      this.#finished[key] = { count: before.count + 1, held: finished.some((item) => item.held) };
    }
  }
}

export const pluginUpdates = new PluginUpdates();
