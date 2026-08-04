export type Route = "chat" | "settings" | "explorer" | "claude" | "monitor" | "terminal" | "markdown";

export interface PreviewRequest {
  url: string;
  name: string;
  onDelete: (() => void) | null;
}

class Navigation {
  route = $state<Route>("chat");
  settingsHighlight = $state<string | null>(null);
  explorerArchive = $state<string | null>(null);
  preview = $state<PreviewRequest | null>(null);

  #terminalFromSettings = false;

  open(route: Route) {
    this.route = route;
  }

  openSettings(highlight: string | null = null) {
    this.settingsHighlight = highlight;
    this.route = "settings";
  }

  openExplorer(archive: string | null = null) {
    this.explorerArchive = archive;
    this.route = "explorer";
  }

  openSshHosts() {
    this.#terminalFromSettings = true;
    this.route = "terminal";
  }

  openPreview(request: PreviewRequest) {
    this.preview = request;
  }

  back() {
    if (this.preview) {
      this.preview = null;
      return;
    }
    if (this.route === "terminal" && this.#terminalFromSettings) {
      this.#terminalFromSettings = false;
      this.route = "settings";
      return;
    }
    this.settingsHighlight = null;
    this.explorerArchive = null;
    this.route = "chat";
  }
}

export const navigation = new Navigation();
