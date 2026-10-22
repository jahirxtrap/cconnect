import { invoke } from "@tauri-apps/api/core";
import { settings } from "$lib/data/settings.svelte";
import { isDesktop, systemName } from "$lib/platform";
import { store } from "$lib/platform/storage";
import { backend } from "$lib/services/backend.svelte";
import { browserCall, browserListen, deviceBrowsing } from "./deviceEngine";

export interface DeviceTab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  open: boolean;
}

export interface DeviceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StoredTabs {
  tabs: { id: string; url: string; title: string; favicon?: string }[];
  active: string;
}

interface PageState {
  id: string;
  url?: string | null;
  title?: string | null;
  favicon?: string | null;
  loading?: boolean | null;
  canGoBack?: boolean | null;
  canGoForward?: boolean | null;
}

export interface DevicePick {
  selector: string;
  text: string;
  html: string;
  width: number;
  height: number;
}

interface Preset {
  width: number;
  height: number;
  density: number;
  model: string;
  phone: boolean;
  webkitAgent: string;
}

interface CdpAnswer {
  backendNodeId?: number;
  object?: { objectId?: string };
  result?: { value?: unknown };
  userAgent?: string;
}

interface Spot {
  x: number;
  y: number;
}

export interface ShieldState {
  ready: boolean;
  updated: number | null;
}

const STORE_KEY = "browser.device";
const PRESET_KEY = "browser.preset";
const PRESETS: Record<string, Preset> = {
  mobile: {
    width: 390,
    height: 844,
    density: 3,
    model: "Pixel 8",
    phone: true,
    webkitAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
  tablet: {
    width: 820,
    height: 1180,
    density: 2,
    model: "Pixel Tablet",
    phone: false,
    webkitAgent:
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  },
};
const ANDROID = "14";
const FALLBACK_MAJOR = "141";
const HIGHLIGHT = {
  showInfo: true,
  contentColor: { r: 111, g: 168, b: 220, a: 0.45 },
  paddingColor: { r: 147, g: 196, b: 125, a: 0.35 },
  marginColor: { r: 246, g: 178, b: 107, a: 0.35 },
};
const DESCRIBE =
  "function() { return window.__cconnect ? JSON.stringify(window.__cconnect.describe(this)) : null; }";
const SEARCH_URL = "https://www.google.com/search?q=";
const LOCAL_HOST = /^(localhost|127(\.\d+){3}|\[::1\])(:\d+)?(\/|$)/i;
const HOST_LIKE = /^[^\s/]+\.[^\s/]+|^[^\s/]+:\d+/;
export const nativePick = systemName() === "windows";
export const devicePresets = deviceBrowsing;
const native = nativePick;
const android = deviceBrowsing && !isDesktop;
const ownMajor = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? FALLBACK_MAJOR;

const addressOf = (input: string): string | null => {
  const target = input.trim();
  if (!target) return null;
  if (target.includes("://")) return target;
  if (LOCAL_HOST.test(target)) return `http://${target}`;
  if (!/\s/.test(target) && HOST_LIKE.test(target)) return `https://${target}`;
  return `${SEARCH_URL}${encodeURIComponent(target)}`;
};

const agentOf = (preset: Preset, major: string) =>
  `Mozilla/5.0 (Linux; Android ${ANDROID}; ${preset.model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 ${preset.phone ? "Mobile " : ""}Safari/537.36`;

const hintsOf = (preset: Preset, major: string) => {
  const brands = [
    { brand: "Chromium", version: major },
    { brand: "Google Chrome", version: major },
    { brand: "Not?A_Brand", version: "99" },
  ];
  return {
    brands,
    fullVersionList: brands.map((item) => ({ ...item, version: `${item.version}.0.0.0` })),
    platform: "Android",
    platformVersion: `${ANDROID}.0.0`,
    architecture: "",
    model: preset.model,
    mobile: preset.phone,
  };
};

const blank = (id: string, url = "", title = "", favicon = ""): DeviceTab => ({
  id,
  url,
  title,
  favicon,
  loading: false,
  canGoBack: false,
  canGoForward: false,
  open: false,
});

const sameBounds = (a: DeviceBounds | null, b: DeviceBounds | null) =>
  a === b ||
  (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

const cdp = (id: string, method: string, params: object = {}) =>
  browserCall<CdpAnswer>("browser_cdp", { id, method, params }).catch(() => null);

class DeviceBrowser {
  tabs = $state<DeviceTab[]>([]);
  activeId = $state("");
  picking = $state(false);
  device = $state(store.get<string>(PRESET_KEY, ""));
  shown = $state<DeviceBounds | null>(null);
  blocked = $state<Record<string, number>>({});
  shield = $state<ShieldState>({ ready: false, updated: null });
  readonly active = $derived(this.tabs.find((tab) => tab.id === this.activeId) ?? null);
  onPicked: ((url: string, pick: DevicePick) => void) | null = null;
  onKey: ((keys: string) => void) | null = null;
  onFocus: (() => void) | null = null;
  #hole: DeviceBounds | null = null;
  #hidden = false;
  #placed: DeviceBounds | null = null;
  #shownId: string | null = null;
  #zooms = new Map<string, number>();
  #emulated = new Map<string, string>();
  #fitted = new Map<string, number>();
  #major: Promise<string> | null = null;
  #aim: Spot | null = null;
  #aiming = false;
  #lit = 0;
  #started = false;
  #guarded: Promise<void> = Promise.resolve();

  start() {
    if (this.#started) return;
    this.#started = true;
    const stored = store.get<StoredTabs>(STORE_KEY, { tabs: [], active: "" });
    this.tabs = stored.tabs.map((tab) => blank(tab.id, tab.url, tab.title, tab.favicon));
    this.activeId = this.tabs.some((tab) => tab.id === stored.active) ? stored.active : (this.tabs[0]?.id ?? "");
    browserListen<PageState>("browser-state", (state) => this.#apply(state));
    browserListen<{ id: string; url: string }>("browser-open", (request) => {
      const at = this.tabs.findIndex((tab) => tab.id === request.id);
      this.newTab(request.url, at < 0 ? this.tabs.length : at + 1);
    });
    browserListen<{ id: string; picking: boolean }>("browser-picking", (state) => {
      if (state.id === this.activeId) this.picking = state.picking;
    });
    browserListen<DevicePick & { id: string }>("browser-picked", (pick) => {
      const tab = this.tabs.find((item) => item.id === pick.id);
      if (tab) this.onPicked?.(tab.url, pick);
    });
    browserListen<{ id: string; keys: string }>("browser-key", (stroke) => this.onKey?.(stroke.keys));
    browserListen<{ id: string }>("browser-focused", () => this.onFocus?.());
    browserListen<{ id: string; blocked: number }>("browser-shield", (count) => {
      this.blocked = { ...this.blocked, [count.id]: count.blocked };
    });
    this.#guarded = this.guard();
  }

  async guard() {
    const { enabled, lists, allowed } = settings.browserShield;
    this.shield = await invoke<ShieldState>("browser_shield", { enabled, lists, allowed }).catch(() => ({
      ready: false,
      updated: null,
    }));
  }

  async refreshLists() {
    const state = await invoke<ShieldState>("browser_shield_update", { lists: settings.browserShield.lists });
    this.shield = state;
  }

  hostOf(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  }

  async allowHere(allowed: boolean) {
    const host = this.hostOf(this.active?.url ?? "");
    if (!host) return;
    const shield = settings.browserShield;
    const others = shield.allowed.filter((item) => item !== host);
    settings.browserShield = { ...shield, allowed: allowed ? [...others, host] : others };
    await this.guard();
    this.reload();
  }

  async restart() {
    await browserCall("browser_restart").catch(() => undefined);
    this.tabs = this.tabs.map((tab) => ({ ...tab, open: false, loading: false }));
    this.#shownId = null;
    this.#placed = null;
    this.#zooms.clear();
    this.#emulated.clear();
    this.#fitted.clear();
    this.#present();
  }

  clearData() {
    return browserCall("browser_clear_data");
  }

  dataSize() {
    return browserCall<number>("browser_data_size").catch(() => 0);
  }

  pick(enabled: boolean) {
    const tab = this.active;
    if (!tab?.open) return;
    this.picking = enabled;
    this.#aim = null;
    this.#lit = 0;
    if (native) void this.#inspect(tab.id, enabled);
    else void browserCall("browser_pick", { id: tab.id, enabled });
  }

  aim(spot: Spot) {
    if (!this.picking || !native) return;
    this.#aim = this.#onPage(spot);
    if (!this.#aiming) void this.#follow();
  }

  async choose(spot: Spot) {
    const tab = this.active;
    if (!this.picking || !native || !tab) return;
    this.pick(false);
    const point = this.#onPage(spot);
    const located = await cdp(tab.id, "DOM.getNodeForLocation", { ...point, ignorePointerEventsNone: true });
    if (!located?.backendNodeId) return;
    const resolved = await cdp(tab.id, "DOM.resolveNode", { backendNodeId: located.backendNodeId });
    const objectId = resolved?.object?.objectId;
    if (!objectId) return;
    const described = await cdp(tab.id, "Runtime.callFunctionOn", {
      objectId,
      functionDeclaration: DESCRIBE,
      returnByValue: true,
    });
    const body = described?.result?.value;
    if (typeof body === "string") this.onPicked?.(tab.url, JSON.parse(body) as DevicePick);
  }

  scroll(spot: Spot, deltaX: number, deltaY: number) {
    const tab = this.active;
    if (!this.picking || !native || !tab) return;
    const point = this.#onPage(spot);
    this.#lit = 0;
    void cdp(tab.id, "Input.dispatchMouseEvent", { type: "mouseWheel", ...point, deltaX, deltaY }).then(() =>
      this.aim(spot),
    );
  }

  #onPage(spot: Spot): Spot {
    const placed = this.#placed;
    const scale = this.#fitted.get(this.activeId) ?? 1;
    const zoom = PRESETS[this.device] ? scale : 1;
    return {
      x: Math.round((spot.x - (placed?.x ?? 0)) / zoom),
      y: Math.round((spot.y - (placed?.y ?? 0)) / zoom),
    };
  }

  async #follow() {
    this.#aiming = true;
    while (this.#aim && this.picking) {
      const point = this.#aim;
      this.#aim = null;
      const id = this.activeId;
      const located = await cdp(id, "DOM.getNodeForLocation", { ...point, ignorePointerEventsNone: true });
      const node = located?.backendNodeId ?? 0;
      if (!this.picking || !node || node === this.#lit) continue;
      this.#lit = node;
      await cdp(id, "Overlay.highlightNode", { highlightConfig: HIGHLIGHT, backendNodeId: node });
    }
    this.#aiming = false;
  }

  setDevice(name: string) {
    if (name === this.device || (name && !PRESETS[name])) return;
    this.device = name;
    store.set(PRESET_KEY, name);
    this.#present();
  }

  keys(list: string[]) {
    void browserCall("browser_keys", { keys: list });
  }

  newTab(url = "", index = this.tabs.length) {
    const tab = blank(crypto.randomUUID(), url);
    this.tabs = [...this.tabs.slice(0, index), tab, ...this.tabs.slice(index)];
    this.switchTab(tab.id);
    return tab.id;
  }

  switchTab(id: string) {
    if (!this.tabs.some((tab) => tab.id === id)) return;
    if (this.picking && id !== this.activeId) this.pick(false);
    this.activeId = id;
    this.#persist();
    this.#present();
  }

  closeTab(id: string) {
    const at = this.tabs.findIndex((tab) => tab.id === id);
    if (at < 0) return;
    if (this.tabs[at].open) void browserCall("browser_close", { id });
    this.#zooms.delete(id);
    this.#emulated.delete(id);
    this.#fitted.delete(id);
    if (this.#shownId === id) this.#shownId = null;
    this.tabs = this.tabs.filter((tab) => tab.id !== id);
    if (this.activeId === id) this.activeId = (this.tabs[at] ?? this.tabs[at - 1])?.id ?? "";
    this.#persist();
    this.#present();
  }

  reorder(ids: string[]) {
    this.tabs = ids.flatMap((id) => this.tabs.filter((tab) => tab.id === id));
    this.#persist();
  }

  navigate(input: string) {
    const url = addressOf(input);
    const tab = this.active;
    if (!url) return;
    if (!tab) {
      this.newTab(url);
      return;
    }
    this.#update(tab.id, { url });
    if (tab.open) void browserCall("browser_navigate", { id: tab.id, url });
    else this.#present();
  }

  back() {
    if (this.active?.open) void browserCall("browser_back", { id: this.active.id });
  }

  forward() {
    if (this.active?.open) void browserCall("browser_forward", { id: this.active.id });
  }

  reload() {
    if (this.active?.open) void browserCall("browser_reload", { id: this.active.id });
  }

  focus() {
    if (this.active?.open) void browserCall("browser_focus", { id: this.active.id });
  }

  release() {
    return browserCall("browser_release").catch(() => undefined);
  }

  place(hole: DeviceBounds | null, hidden = false) {
    if (sameBounds(hole, this.#hole) && hidden === this.#hidden) return;
    this.#hole = hole;
    this.#hidden = hidden;
    this.#present();
  }

  #fit(hole: DeviceBounds): { bounds: DeviceBounds; zoom: number } {
    const preset = PRESETS[this.device];
    if (!preset) return { bounds: hole, zoom: 1 };
    const zoom = Math.min(1, hole.width / preset.width, hole.height / preset.height);
    const width = Math.round(preset.width * zoom);
    const height = Math.round(preset.height * zoom);
    return {
      bounds: {
        x: hole.x + Math.round((hole.width - width) / 2),
        y: hole.y + Math.round((hole.height - height) / 2),
        width,
        height,
      },
      zoom,
    };
  }

  #present() {
    const tab = this.active;
    const hole = this.#hole;
    const showing = tab && tab.url && hole && !this.#hidden ? tab.id : null;
    if (this.#shownId && this.#shownId !== showing) {
      void browserCall("browser_visible", { id: this.#shownId, visible: false });
      this.#shownId = null;
    }
    if (!showing || !tab || !hole) {
      this.shown = null;
      return;
    }
    const { bounds, zoom } = this.#fit(hole);
    if (!tab.open) {
      this.#update(tab.id, { open: true, loading: true });
      void this.#open(tab.id);
    } else {
      if (!sameBounds(bounds, this.#placed) || this.#shownId !== tab.id) {
        void browserCall("browser_bounds", { id: tab.id, ...bounds });
      }
      this.#adapt(tab.id, zoom);
      if (this.#shownId !== tab.id) void browserCall("browser_visible", { id: tab.id, visible: true });
    }
    this.#placed = bounds;
    this.#shownId = tab.id;
    if (!sameBounds(this.shown, bounds)) this.shown = bounds;
  }

  async #open(id: string) {
    await this.#guarded;
    const tab = this.tabs.find((item) => item.id === id);
    const hole = this.#hole;
    if (!tab) return;
    if (!hole) {
      this.#update(id, { open: false, loading: false });
      return;
    }
    const { bounds, zoom } = this.#fit(hole);
    try {
      await browserCall("browser_open", {
        id,
        url: tab.url,
        ...bounds,
        proxy: { ...settings.browserProxy, keep: backend.environments.map((profile) => profile.host) },
      });
    } catch {
      this.#update(id, { open: false, loading: false });
      return;
    }
    if (this.#shownId !== id) {
      void browserCall("browser_visible", { id, visible: false });
      return;
    }
    void browserCall("browser_bounds", { id, ...bounds });
    void browserCall("browser_visible", { id, visible: true });
    this.#adapt(id, zoom);
  }

  #adapt(id: string, zoom: number) {
    if (native) {
      void this.#emulate(id, zoom);
      return;
    }
    this.#zoom(id, zoom);
    this.#agent(id);
  }

  #agent(id: string) {
    const name = this.device;
    if ((this.#emulated.get(id) ?? "") === name) return;
    this.#emulated.set(id, name);
    const preset = PRESETS[name];
    const agent = !preset ? null : android ? agentOf(preset, ownMajor) : preset.webkitAgent;
    void browserCall("browser_agent", { id, agent }).catch(() => this.#emulated.delete(id));
  }

  #zoom(id: string, zoom: number) {
    if (this.#zooms.get(id) === zoom) return;
    this.#zooms.set(id, zoom);
    void browserCall("browser_zoom", { id, zoom }).catch(() => this.#zooms.delete(id));
  }

  #engine(id: string) {
    this.#major ??= cdp(id, "Browser.getVersion").then(
      (answer) => answer?.userAgent?.match(/Chrome\/(\d+)/)?.[1] ?? FALLBACK_MAJOR,
    );
    return this.#major;
  }

  async #emulate(id: string, zoom: number) {
    const name = this.device;
    const preset = PRESETS[name];
    const applied = this.#emulated.get(id) ?? "";
    const fresh = applied !== name;
    if (!fresh && (!preset || this.#fitted.get(id) === zoom)) return;
    this.#emulated.set(id, name);
    this.#fitted.set(id, zoom);
    if (!preset) {
      await cdp(id, "Emulation.clearDeviceMetricsOverride");
      await cdp(id, "Emulation.setTouchEmulationEnabled", { enabled: false });
      await cdp(id, "Emulation.setEmitTouchEventsForMouse", { enabled: false });
      await cdp(id, "Emulation.setUserAgentOverride", { userAgent: "" });
      await cdp(id, "Page.reload");
      return;
    }
    if (fresh) {
      const major = await this.#engine(id);
      await cdp(id, "Emulation.setUserAgentOverride", {
        userAgent: agentOf(preset, major),
        platform: "Linux armv8l",
        userAgentMetadata: hintsOf(preset, major),
      });
      await cdp(id, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await cdp(id, "Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" });
    }
    await cdp(id, "Emulation.setDeviceMetricsOverride", {
      width: preset.width,
      height: preset.height,
      deviceScaleFactor: preset.density,
      mobile: true,
      scale: zoom,
    });
    if (fresh) await cdp(id, "Page.reload");
  }

  async #inspect(id: string, enabled: boolean) {
    if (!enabled) {
      await cdp(id, "Overlay.hideHighlight");
      return;
    }
    await cdp(id, "DOM.enable");
    await cdp(id, "Overlay.enable");
  }

  #apply(state: PageState) {
    const patch: Partial<DeviceTab> = {};
    if (state.url) patch.url = state.url;
    if (typeof state.title === "string") patch.title = state.title;
    if (typeof state.favicon === "string") patch.favicon = state.favicon;
    if (typeof state.loading === "boolean") patch.loading = state.loading;
    if (typeof state.canGoBack === "boolean") patch.canGoBack = state.canGoBack;
    if (typeof state.canGoForward === "boolean") patch.canGoForward = state.canGoForward;
    if (patch.loading && state.id === this.activeId) this.picking = false;
    this.#update(state.id, patch);
    if (patch.url || patch.title !== undefined || patch.favicon !== undefined) this.#persist();
  }

  #update(id: string, patch: Partial<DeviceTab>) {
    this.tabs = this.tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab));
  }

  #persist() {
    store.set<StoredTabs>(STORE_KEY, {
      tabs: this.tabs.map(({ id, url, title, favicon }) => ({ id, url, title, favicon })),
      active: this.activeId,
    });
  }
}

export const deviceBrowser = new DeviceBrowser();
