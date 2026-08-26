import { backend } from "$lib/services/backend.svelte";
import { dismissTop } from "$lib/app/dismissStack";

export const ROUTES = ["/settings", "/claude", "/monitor", "/files", "/terminal", "/markdown"] as const;

export type Route = (typeof ROUTES)[number] | "/";

const baseOf = (path: string): Route => {
  const base = (ROUTES as readonly string[]).find((route) => path === route || path.startsWith(`${route}/`));
  return (base as Route) ?? "/";
};

/** The segment after the route: a screen that lives inside one, with an entry of its own in the
 *  history. What it means is each screen's business — this only carries it to and from the URL. */
const subOf = (path: string): string | null => {
  const base = (ROUTES as readonly string[]).find((route) => path.startsWith(`${route}/`));
  return base ? decodeURIComponent(path.slice(base.length + 1)) || null : null;
};

export interface PreviewRequest {
  url: string;
  name: string;
  onDelete: (() => void) | null;
}

const currentRoute = (): Route => baseOf(window.location.pathname);

class Navigation {
  route = $state<Route>(currentRoute());
  sub = $state<string | null>(subOf(window.location.pathname));
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
        this.sub = subOf(window.location.pathname);
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });
  }

  navigate(target: Route) {
    if (this.route === target && this.sub === null) return;
    this.#layers = 0;
    this.sub = null;
    window.history.pushState(null, "", target);
    this.route = target;
  }

  openSub(value: string) {
    if (this.sub === value) return;
    this.sub = value;
    window.history.pushState(null, "", `${this.route}/${encodeURIComponent(value)}`);
  }

  closeSub() {
    if (this.sub !== null) window.history.back();
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
