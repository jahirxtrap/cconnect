import { backend } from "$lib/services/backend.svelte";
import { consumingDismiss, dismissTop } from "$lib/app/dismissStack";
import type { PreviewKind } from "$lib/data/previewKind";
import { isTauri } from "$lib/platform";

export const ROUTES = [
  "/settings",
  "/claude",
  "/monitor",
  "/shared",
  "/project",
  "/terminal",
  "/notes",
  "/browser",
] as const;

export type Route = (typeof ROUTES)[number] | "/";

const baseOf = (path: string): Route => {
  const base = (ROUTES as readonly string[]).find((route) => path === route || path.startsWith(`${route}/`));
  return (base as Route) ?? "/";
};

const subOf = (path: string): string | null => {
  const base = (ROUTES as readonly string[]).find((route) => path.startsWith(`${route}/`));
  return base ? decodeURIComponent(path.slice(base.length + 1)) || null : null;
};

export interface PreviewRequest {
  url: string;
  name: string;
  kind?: PreviewKind | null;
  onDelete: (() => void) | null;
}

const WEB_BLOCKED: Route[] = ["/terminal", "/browser", "/project"];

const blocked = (route: Route) => !isTauri && WEB_BLOCKED.includes(route);

const currentRoute = (): Route => {
  const route = baseOf(window.location.pathname);
  return blocked(route) ? "/" : route;
};

class Navigation {
  route = $state<Route>(currentRoute());
  sub = $state<string | null>(subOf(window.location.pathname));
  settingsHighlight = $state<string | null>(null);
  sharedTarget = $state<string | null>(null);
  preview = $state<PreviewRequest | null>(null);
  previewPane = $state(false);

  readonly previewOverlay = $derived(this.preview !== null && !this.previewPane);

  readonly chatActive = $derived(this.route === "/");

  routeLocked = $state(false);

  start() {
    if (blocked(baseOf(window.location.pathname))) {
      window.history.replaceState(null, "", "/");
    }
    if (!backend.configured) {
      if (window.location.pathname === "/") window.history.pushState(null, "", "/settings");
      this.route = "/settings";
    }

    (window as unknown as { __cconnectBack?: () => boolean }).__cconnectBack = () => {
      if (dismissTop()) return true;
      if (this.close()) return true;
      if (this.route === "/") return false;
      this.settingsHighlight = null;
      this.sharedTarget = null;
      window.history.back();
      return true;
    };

    $effect(() => {
      const onPopState = () => {
        if (consumingDismiss()) return;
        if (dismissTop()) return;
        if (this.previewOverlay) {
          this.preview = null;
          return;
        }
        if (this.#dismiss()) {
          window.history.pushState(null, "", this.#url());
          return;
        }
        this.route = currentRoute();
        this.sub = subOf(window.location.pathname);
        this.#closingSettings = false;
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });
  }

  navigate(target: Route) {
    if (this.route === target && this.sub === null) return;
    this.sub = null;
    window.history.pushState(null, "", target);
    this.route = target;
  }

  openSub(value: string) {
    if (this.sub === value) return;
    this.sub = value;
    window.history.pushState(null, "", `${this.route}/${encodeURIComponent(value)}`);
  }

  showSub(value: string) {
    if (this.sub === value) return;
    this.sub = value;
    window.history.replaceState(null, "", `${this.route}/${encodeURIComponent(value)}`);
  }

  closeSub() {
    if (this.sub !== null) window.history.back();
  }

  clearSub() {
    if (this.sub === null) return;
    this.sub = null;
    window.history.replaceState(null, "", this.route);
  }

  openSettings(highlight: string | null = null) {
    this.settingsHighlight = highlight;
    this.#closingSettings = false;
    if (this.route === "/settings") {
      this.clearSub();
      return;
    }
    this.navigate("/settings");
  }

  closeSettings() {
    if (this.route !== "/settings" || this.#closingSettings) return;
    this.#closingSettings = true;
    this.back();
  }

  openClaude(highlight: string | null = null) {
    this.settingsHighlight = highlight;
    this.navigate("/claude");
  }

  openClaudeSub(sub: string) {
    this.navigate("/claude");
    this.openSub(sub);
  }

  openShared(target: string | null = null) {
    this.sharedTarget = target;
    this.navigate("/shared");
  }

  openSshHosts() {
    this.navigate("/terminal");
  }

  openPreview(request: PreviewRequest) {
    this.preview = request;
    this.previewPane = false;
    window.history.pushState({ overlay: "preview" }, "", window.location.href);
  }

  closePreview() {
    if (this.previewOverlay) window.history.back();
  }

  intercept(handler: () => boolean) {
    this.#interceptors.push(handler);
    return () => {
      this.#interceptors = this.#interceptors.filter((item) => item !== handler);
    };
  }

  close(): boolean {
    if (this.previewOverlay) {
      this.closePreview();
      return true;
    }
    if (this.#dismiss()) return true;
    return false;
  }

  forward() {
    if (this.routeLocked) return;
    window.history.forward();
  }

  back() {
    if (this.close()) return;
    if (this.routeLocked) return;
    this.settingsHighlight = null;
    this.sharedTarget = null;
    window.history.back();
  }

  #url(): string {
    const path = this.sub === null ? this.route : `${this.route}/${encodeURIComponent(this.sub)}`;
    return window.location.pathname === path ? path + window.location.search : path;
  }

  #dismiss(): boolean {
    for (let index = this.#interceptors.length - 1; index >= 0; index--) {
      if (this.#interceptors[index]()) return true;
    }
    return false;
  }

  #closingSettings = false;

  #interceptors: (() => boolean)[] = [];
}

export const navigation = new Navigation();
