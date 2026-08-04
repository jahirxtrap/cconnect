import { backend } from "$lib/services/backend.svelte";

export const ROUTES = ["/settings", "/claude", "/monitor", "/files", "/terminal", "/markdown"] as const;

export type Route = (typeof ROUTES)[number] | "/";

export interface PreviewRequest {
  url: string;
  name: string;
  onDelete: (() => void) | null;
}

const currentRoute = (): Route => {
  const path = window.location.pathname;
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : "/";
};

class Navigation {
  route = $state<Route>(currentRoute());
  settingsHighlight = $state<string | null>(null);
  explorerArchive = $state<string | null>(null);
  preview = $state<PreviewRequest | null>(null);

  start() {
    if (!backend.configured) {
      if (window.location.pathname === "/") window.history.pushState(null, "", "/settings");
      this.route = "/settings";
    }

    $effect(() => {
      const onPopState = () => (this.route = currentRoute());
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });
  }

  navigate(target: Route) {
    if (this.route === target) return;
    window.history.pushState(null, "", target);
    this.route = target;
  }

  openSettings(highlight: string | null = null) {
    this.settingsHighlight = highlight;
    this.navigate("/settings");
  }

  openExplorer(archive: string | null = null) {
    this.explorerArchive = archive;
    this.navigate("/files");
  }

  openSshHosts() {
    this.navigate("/terminal");
  }

  openPreview(request: PreviewRequest) {
    this.preview = request;
  }

  back() {
    if (this.preview) {
      this.preview = null;
      return;
    }
    this.settingsHighlight = null;
    this.explorerArchive = null;
    window.history.back();
  }
}

export const navigation = new Navigation();
