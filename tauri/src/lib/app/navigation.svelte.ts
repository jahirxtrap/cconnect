import { backend } from "$lib/services/backend.svelte";
import { dismissTop } from "$lib/app/dismissStack";

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

    (window as unknown as { __cconnectBack?: () => boolean }).__cconnectBack = () => {
      if (dismissTop()) return true;
      if (this.#layers > 0 || this.preview) {
        window.history.back();
        return true;
      }
      if (this.route === "/") return false;
      this.settingsHighlight = null;
      this.explorerArchive = null;
      window.history.back();
      return true;
    };

    $effect(() => {
      const onPopState = () => {
        if (dismissTop()) {
          window.history.pushState(null, "", window.location.href);
          return;
        }
        if (this.preview) {
          this.preview = null;
          return;
        }
        if (this.#layers > 0) {
          this.#layers--;
          if (this.#dismiss()) return;
        } else if (this.#dismiss()) {
          window.history.pushState(null, "", window.location.href);
          return;
        }
        this.route = currentRoute();
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });
  }

  navigate(target: Route) {
    if (this.route === target) return;
    this.#layers = 0;
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
    window.history.pushState({ overlay: "preview" }, "", window.location.href);
  }

  closePreview() {
    if (this.preview) window.history.back();
  }

  pushLayer() {
    this.#layers++;
    window.history.pushState({ layer: this.#layers }, "", window.location.href);
  }

  popLayer() {
    if (this.#layers > 0) window.history.back();
  }

  intercept(handler: () => boolean) {
    this.#interceptors.push(handler);
    return () => {
      this.#interceptors = this.#interceptors.filter((item) => item !== handler);
    };
  }

  close(): boolean {
    if (this.preview) {
      this.closePreview();
      return true;
    }
    if (this.#layers > 0) {
      this.popLayer();
      return true;
    }
    return this.#dismiss();
  }

  back() {
    if (this.close()) return;
    this.settingsHighlight = null;
    this.explorerArchive = null;
    window.history.back();
  }

  #dismiss(): boolean {
    for (let index = this.#interceptors.length - 1; index >= 0; index--) {
      if (this.#interceptors[index]()) return true;
    }
    return false;
  }

  #layers = 0;
  #interceptors: (() => boolean)[] = [];
}

export const navigation = new Navigation();
