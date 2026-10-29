import { chatListFor } from "$lib/data/chatList.svelte";
import { settings } from "$lib/data/settings.svelte";
import { agentTabs } from "$lib/screens/agents/agentTabs.svelte";
import { backend } from "$lib/services/backend.svelte";
import { panes } from "./panes.svelte";
import { tabs } from "./tabs.svelte";

class PanelProject {
  readonly list = $derived(chatListFor(backend.active));
  readonly followed = $derived(panes.contextChat.workingProject);
  readonly pinned = $derived((panes.contextAgentTab ?? panes.focusedTab)?.panelProject ?? null);
  readonly settled = $derived(this.list !== null && !this.list.loading);
  readonly key = $derived.by(() => {
    const wanted = settings.lockedProject || (this.pinned === null ? this.followed : this.pinned || null);
    return !this.settled || this.known(wanted) ? wanted : this.known(this.followed) ? this.followed : null;
  });
  readonly path = $derived(tabs.state.allProjects.find((item) => item.projectKey === this.key)?.path ?? null);

  known(key: string | null): boolean {
    return key !== null && (this.list?.projects ?? []).some((item) => item.projectKey === key);
  }

  pin(projectKey: string | null) {
    const agentTab = panes.contextAgentTab;
    if (agentTab) agentTabs.setPanelProject(agentTab.id, projectKey);
    else if (panes.focusedTab) tabs.setPanelProject(panes.focusedTab.id, projectKey);
  }
}

export const panelProject = new PanelProject();
