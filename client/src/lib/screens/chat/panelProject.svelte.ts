import { chatListFor } from "$lib/data/chatList.svelte";
import { settings } from "$lib/data/settings.svelte";
import { backend } from "$lib/services/backend.svelte";
import { tabs } from "./tabs.svelte";

class PanelProject {
  readonly list = $derived(chatListFor(backend.active));
  readonly followed = $derived(tabs.state.historyProject);
  readonly pinned = $derived(tabs.active?.panelProject ?? null);
  readonly settled = $derived(this.list !== null && !this.list.loading);
  readonly key = $derived.by(() => {
    const wanted = settings.lockedProject || (this.pinned === null ? this.followed : this.pinned || null);
    return !this.settled || this.known(wanted) ? wanted : this.known(this.followed) ? this.followed : null;
  });
  readonly path = $derived(tabs.state.allProjects.find((item) => item.projectKey === this.key)?.path ?? null);

  known(key: string | null): boolean {
    return key !== null && (this.list?.projects ?? []).some((item) => item.projectKey === key);
  }
}

export const panelProject = new PanelProject();
