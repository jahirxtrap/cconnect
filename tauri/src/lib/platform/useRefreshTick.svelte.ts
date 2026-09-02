import { desktop } from "./desktop.svelte";

export const useRefreshTick = (onRefresh: () => void) => {
  let seen = desktop.refreshTick;

  $effect(() => {
    if (desktop.refreshTick === seen) return;
    seen = desktop.refreshTick;
    onRefresh();
  });
};
