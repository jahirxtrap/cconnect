import { untrack } from "svelte";
import type { InstalledAgent } from "$lib/data/agentModels";
import { createAgentsApi, type AgentList } from "./agentsApi";
import { backend, type Profile } from "./backend.svelte";
import { imageCache } from "./imageCache.svelte";
import { fetchBlob } from "./mediaSource";

class Agents {
  #lists = $state<Record<string, AgentList>>({});
  #failed = $state<Record<string, boolean>>({});

  listOf(profile: Profile): AgentList | null {
    return profile ? (this.#lists[profile.id] ?? null) : null;
  }

  failed(profile: Profile): boolean {
    return profile ? this.#failed[profile.id] === true : false;
  }

  usable(profile: Profile): InstalledAgent[] {
    return (this.listOf(profile)?.agents ?? []).filter((agent) => agent.enabled && agent.protocol === "acp");
  }

  find(profile: Profile, id: string | null): InstalledAgent | null {
    return id ? (this.listOf(profile)?.agents.find((agent) => agent.id === id) ?? null) : null;
  }

  iconOf(profile: Profile, id: string | null): string | null {
    const agent = this.find(profile, id);
    return agent?.icon ? createAgentsApi(() => profile).iconUrl(agent.id, agent.version) : null;
  }

  iconSrc(url: string): string | null {
    return imageCache.get(url);
  }

  loadIcon(url: string) {
    imageCache.load(url, () => fetchBlob(url));
  }

  async refresh(profile: Profile = backend.active) {
    if (!profile) return;
    untrack(() => (this.#failed = { ...this.#failed, [profile.id]: false }));
    const found = await createAgentsApi(() => profile).list();
    if (found) this.#lists = { ...this.#lists, [profile.id]: found };
    this.#failed = { ...this.#failed, [profile.id]: !found };
  }
}

export const agents = new Agents();

export const useAgents = () => {
  $effect(() => {
    void agents.refresh(backend.active);
  });
};
