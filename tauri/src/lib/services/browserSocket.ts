import { ReconnectingSocket } from "./socket";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export interface BrowserState {
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
}

export interface BrowserPick {
  selector: string;
  text: string;
  html: string;
  width: number;
  height: number;
}

export interface BrowserHooks {
  onFrame: (bitmap: ImageBitmap) => void;
  onState: (state: BrowserState) => void;
  onConnected: (value: boolean) => void;
  onPicked: (pick: BrowserPick) => void;
  onCursor: (shape: string) => void;
  onClipboard: (text: string) => void;
}

export interface BrowserViewport {
  width: number;
  height: number;
  scale: number;
}

export interface BrowserLink {
  navigate: (url: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  resize: (viewport: BrowserViewport) => void;
  device: (name: string) => void;
  pick: (enabled: boolean) => void;
  clip: (cut: boolean) => void;
  newTab: () => void;
  switchTab: (id: string) => void;
  closeTab: (id: string) => void;
  reorder: (ids: string[]) => void;
  mouse: (payload: Record<string, unknown>) => void;
  key: (payload: Record<string, unknown>) => void;
  text: (value: string) => void;
  close: () => void;
}

export const browserLink = (hooks: BrowserHooks, viewport: () => BrowserViewport): BrowserLink => {
  let disposed = false;
  let decoding = false;
  let pending: ArrayBuffer | null = null;

  const draw = (buffer: ArrayBuffer) => {
    if (decoding) {
      pending = buffer;
      return;
    }
    decoding = true;
    void createImageBitmap(new Blob([buffer], { type: "image/jpeg" }))
      .then((bitmap) => (disposed ? bitmap.close() : hooks.onFrame(bitmap)))
      .catch(() => undefined)
      .finally(() => {
        decoding = false;
        const next = pending;
        pending = null;
        if (next && !disposed) draw(next);
      });
  };

  const socket = new ReconnectingSocket("/browser/ws", {
    onOpen: () => socket.send({ type: "attach", ...viewport() }),
    onBinary: draw,
    onMessage: (data) => {
      if (data.type === "picked") {
        hooks.onPicked(data as unknown as BrowserPick);
        return;
      }
      if (data.type === "cursor") {
        hooks.onCursor((data.shape as string) || "auto");
        return;
      }
      if (data.type === "clipboard") {
        hooks.onClipboard((data.text as string) || "");
        return;
      }
      if (data.type !== "state") return;
      hooks.onConnected(true);
      hooks.onState({
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
      });
    },
    onDrop: () => hooks.onConnected(false),
  });

  socket.connect();

  const post = (payload: Record<string, unknown>) => socket.send(payload);

  return {
    navigate: (url) => post({ type: "navigate", url }),
    back: () => post({ type: "back" }),
    forward: () => post({ type: "forward" }),
    reload: () => post({ type: "reload" }),
    resize: (next) => post({ type: "resize", ...next }),
    device: (name) => post({ type: "device", name }),
    pick: (enabled) => post({ type: "pick", enabled }),
    clip: (cut) => post({ type: "clip", cut }),
    newTab: () => post({ type: "new_tab" }),
    switchTab: (id) => post({ type: "switch_tab", id }),
    closeTab: (id) => post({ type: "close_tab", id }),
    reorder: (ids) => post({ type: "reorder", ids }),
    mouse: (payload) => post({ type: "mouse", ...payload }),
    key: (payload) => post({ type: "key", ...payload }),
    text: (value) => post({ type: "text", value }),
    close: () => {
      disposed = true;
      socket.close();
    },
  };
};
