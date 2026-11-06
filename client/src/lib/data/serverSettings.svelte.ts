import { untrack } from "svelte";
import { loads } from "$lib/data/inflight";
import { backend, type Profile } from "$lib/services/backend.svelte";
import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
import { settingsApi, type SettingsPatch, type SettingsSnapshot } from "$lib/services/settingsApi";

class ServerSettings {
  snapshot = $state<SettingsSnapshot | null>(null);
  capabilities = $state<Capabilities | null>(null);
  loading = $state(true);
  #loadedFor = $state<string | null>(null);
  #requested: string | null | undefined = undefined;

  get ready() {
    return this.snapshot !== null;
  }

  capabilitiesFor(profile: Profile | null): Capabilities | null | undefined {
    return profile && this.#loadedFor === profile.id ? this.capabilities : undefined;
  }

  load() {
    return loads.track(this.#load());
  }

  async #load() {
    const profile = backend.active?.id ?? null;
    this.#requested = profile;
    this.loading = true;
    if (!backend.configured) {
      this.snapshot = null;
      this.capabilities = null;
      this.#loadedFor = null;
      this.loading = false;
      return;
    }
    const capabilities = await capabilitiesApi.capabilities();
    if (this.#requested !== profile) return;
    this.capabilities = capabilities;
    this.#loadedFor = profile;
    const snapshot = await settingsApi.get();
    if (this.#requested !== profile) return;
    this.snapshot = snapshot;
    this.loading = false;
  }

  ensure() {
    const profile = backend.active?.id ?? null;
    if (this.#requested === profile && untrack(() => this.snapshot !== null || this.loading)) return;
    untrack(() => void this.load());
  }

  async update(patch: SettingsPatch) {
    const result = await settingsApi.update(patch);
    if (result) this.snapshot = result;
    return result;
  }
}

export const serverSettings = new ServerSettings();
