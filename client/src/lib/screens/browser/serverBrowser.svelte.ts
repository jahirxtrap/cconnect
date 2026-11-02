import { panes } from "$lib/screens/chat/panes.svelte";

class ServerBrowser {
  pending = $state<string | null>(null);

  open(url: string) {
    this.pending = url;
    panes.show("browser");
  }

  take(): string | null {
    const url = this.pending;
    this.pending = null;
    return url;
  }
}

export const serverBrowser = new ServerBrowser();
