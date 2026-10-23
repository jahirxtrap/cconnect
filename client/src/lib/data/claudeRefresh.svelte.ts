import { tick } from "svelte";
import { holdRefresh, loads } from "$lib/data/inflight";

class ClaudeRefresh {
  tick = $state(0);
  refreshing = $state(false);

  async run() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.tick++;
    await holdRefresh(tick().then(() => loads.settled()));
    this.refreshing = false;
  }
}

export const claudeRefresh = new ClaudeRefresh();
