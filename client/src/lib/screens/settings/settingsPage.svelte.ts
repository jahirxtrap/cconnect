import { tick as svelteTick } from "svelte";
import { navigation } from "$lib/app/navigation.svelte";
import { useHighlight } from "$lib/app/useHighlight.svelte";
import { holdRefresh, loads } from "$lib/data/inflight";
import { serverStatus } from "$lib/data/serverStatus.svelte";
import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
import type { SettingsSection } from "./sections";
import { entryFor, type SettingsEntry } from "./settingsIndex";

export const useSettingsPage = (onSection: (section: SettingsSection) => void, hostsClaude = false) => {
  let tick = $state(0);
  let refreshing = $state(false);
  let query = $state("");
  let hosting = $state<SettingsSection | null>(null);

  const refresh = async () => {
    if (refreshing) return;
    refreshing = true;
    tick++;
    await holdRefresh(svelteTick().then(() => loads.settled()));
    refreshing = false;
  };

  useRefreshTick(() => void refresh());

  $effect(() => {
    if (tick === 0) return;
    void loads.track(serverStatus.refresh());
  });

  const highlight = useHighlight((target) => {
    const section = entryFor(target)?.section ?? "about";
    onSection(hostsClaude || (section !== "general" && section !== "claude") ? section : "about");
  });

  return {
    highlight,
    get tick() {
      return tick;
    },
    get refreshing() {
      return refreshing;
    },
    get query() {
      return query;
    },
    get searching() {
      return query.trim().length > 0;
    },
    get hosting() {
      return hosting;
    },
    search(value: string) {
      query = value;
      hosting = null;
    },
    changed() {
      tick++;
    },
    refresh,
    reveal(entry: SettingsEntry) {
      const elsewhere = entry.section === "claude" && !hostsClaude;
      hosting = entry.dialog !== undefined && !elsewhere ? entry.section : null;
      if (!hosting) query = "";
      if (elsewhere) navigation.openClaude(entry.id);
      else navigation.openSettings(entry.id);
    },
  };
};

export type SettingsPage = ReturnType<typeof useSettingsPage>;
