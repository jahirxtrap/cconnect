import { backend } from "$lib/services/backend.svelte";
import { capabilitiesApi, type Capabilities } from "$lib/services/capabilitiesApi";
import { settingsApi, type SettingsPatch, type SettingsSnapshot } from "$lib/services/settingsApi";

class ServerSettings {
  snapshot = $state<SettingsSnapshot | null>(null);
  capabilities = $state<Capabilities | null>(null);
  loading = $state(true);

  get ready() {
    return this.snapshot !== null;
  }

  async load() {
    this.loading = true;
    if (!backend.configured) {
      this.snapshot = null;
      this.capabilities = null;
      this.loading = false;
      return;
    }
    this.capabilities = await capabilitiesApi.capabilities();
    this.snapshot = await settingsApi.get();
    this.loading = false;
  }

  ensure() {
    if (this.snapshot === null) void this.load();
  }

  async update(patch: SettingsPatch) {
    const result = await settingsApi.update(patch);
    if (result) this.snapshot = result;
    return result;
  }
}

export const serverSettings = new ServerSettings();
