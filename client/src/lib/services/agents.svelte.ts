import type { InstalledAgent } from "$lib/data/agentModels";
import { createAgentsApi, type AgentList } from "./agentsApi";
import { backend, type Profile } from "./backend.svelte";

class Agents {
  #lists = $state<Record<string, AgentList>>({});

  listOf(profile: Profile): AgentList | null {
    return profile ? (this.#lists[profile.id] ?? null) : null;
  }

  usable(profile: Profile): InstalledAgent[] {
    return (this.listOf(profile)?.agents ?? []).filter((agent) => agent.enabled && agent.protocol === "acp");
  }

  find(profile: Profile, id: string | null): InstalledAgent | null {
    return id ? (this.listOf(profile)?.agents.find((agent) => agent.id === id) ?? null) : null;
  }

  iconOf(profile: Profile, id: string | null): string | null {
    return this.find(profile, id)?.icon && id ? createAgentsApi(() => profile).iconUrl(id) : null;
  }

  async refresh(profile: Profile = backend.active) {
    const found = await createAgentsApi(() => profile).list();
    if (found && profile) this.#lists = { ...this.#lists, [profile.id]: found };
  }
}

export const agents = new Agents();

export const useAgents = () => {
  $effect(() => {
    void agents.refresh(backend.active);
  });
};
