import type { ElementPick } from "$lib/data/pickedElements";
import { http } from "./http";
import { ReconnectingSocket } from "./socket";

export const stopBrowser = () => http.post("/browser/stop");

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

export interface BrowserState {
  available: boolean;
  running: boolean;
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  activeTab: string;
  tabs: BrowserTab[];
  pageWidth: number;
  pageHeight: number;
  device: string;
  picking: boolean;
  stream: string;
}

export interface StreamInfo {
  codec: string;
  width: number;
  height: number;
}

export interface BrowserHooks {
  onFrame: (buffer: ArrayBuffer) => void;
  onStream: (info: StreamInfo) => void;
  onState: (state: BrowserState) => void;
  onConnected: (value: boolean) => void;
  onPicked: (pick: ElementPick) => void;
  onCursor: (shape: string) => void;
  onEditing: (active: boolean, tapped: boolean) => void;
  onClipboard: (text: string) => void;
  onError: () => void;
}

export interface BrowserViewport {
  width: number;
  height: number;
  scale: number;
}

export interface BrowserLink {
  watch: (enabled: boolean) => void;
  navigate: (url: string) => void;
  home: () => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  resize: (viewport: BrowserViewport) => void;
  device: (name: string) => void;
  pick: (enabled: boolean) => void;
  clip: (cut: boolean) => void;
  newTab: (url?: string) => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  reorder: (ids: string[]) => void;
  mouse: (payload: Record<string, unknown>) => void;
  touch: (payload: Record<string, unknown>) => void;
  key: (payload: Record<string, unknown>) => void;
  text: (value: string) => void;
  keyframe: () => void;
  close: () => void;
}

export const videoDecodable = typeof VideoDecoder !== "undefined";

export const browserLink = (hooks: BrowserHooks, viewport: () => BrowserViewport): BrowserLink => {
  let watched = false;

  const socket = new ReconnectingSocket("/browser/ws", {
    onOpen: () => socket.send({ type: "attach", watch: watched, video: videoDecodable, ...viewport() }),
    onBinary: (buffer) => {
      if (watched) hooks.onFrame(buffer);
    },
    onMessage: (data) => {
      if (data.type === "stream") {
        hooks.onStream({
          codec: (data.codec as string) ?? "",
          width: (data.width as number) ?? 0,
          height: (data.height as number) ?? 0,
        });
        return;
      }
      if (data.type === "picked") {
        hooks.onPicked(data as unknown as ElementPick);
        return;
      }
      if (data.type === "cursor") {
        hooks.onCursor((data.shape as string) || "auto");
        return;
      }
      if (data.type === "editing") {
        hooks.onEditing(data.active === true, data.tapped === true);
        return;
      }
      if (data.type === "clipboard") {
        hooks.onClipboard((data.text as string) || "");
        return;
      }
      if (data.type === "error") {
        hooks.onError();
        return;
      }
      if (data.type !== "state") return;
      hooks.onConnected(true);
      hooks.onState({
        available: data.available === true,
        running: data.running === true,
        url: (data.url as string) ?? "",
        title: (data.title as string) ?? "",
        canGoBack: data.canGoBack === true,
        canGoForward: data.canGoForward === true,
        activeTab: (data.activeTab as string) ?? "",
        tabs: (data.tabs as BrowserTab[]) ?? [],
        pageWidth: (data.pageWidth as number) ?? 0,
        pageHeight: (data.pageHeight as number) ?? 0,
        device: (data.device as string) ?? "",
        picking: data.picking === true,
        stream: (data.stream as string) ?? "jpeg",
      });
    },
    onDrop: () => hooks.onConnected(false),
  });

  socket.connect();

  const post = (payload: Record<string, unknown>) => socket.send(payload);

  return {
    watch: (enabled) => {
      if (enabled === watched) return;
      watched = enabled;
      post({ type: "watch", enabled, ...viewport() });
    },
    navigate: (url) => post({ type: "navigate", url }),
    home: () => post({ type: "home" }),
    back: () => post({ type: "back" }),
    forward: () => post({ type: "forward" }),
    reload: () => post({ type: "reload" }),
    resize: (next) => post({ type: "resize", ...next }),
    device: (name) => post({ type: "device", name }),
    pick: (enabled) => post({ type: "pick", enabled }),
    clip: (cut) => post({ type: "clip", cut }),
    newTab: (url = "") => post({ type: "new_tab", url }),
    switchTab: (id) => post({ type: "switch_tab", id }),
    closeTab: (id) => post({ type: "close_tab", id }),
    reorder: (ids) => post({ type: "reorder", ids }),
    mouse: (payload) => post({ type: "mouse", ...payload }),
    touch: (payload) => post({ type: "touch", ...payload }),
    key: (payload) => post({ type: "key", ...payload }),
    text: (value) => post({ type: "text", value }),
    keyframe: () => post({ type: "keyframe" }),
    close: () => socket.close(),
  };
};
