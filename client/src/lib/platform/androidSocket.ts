interface LinkBridge {
  open: (id: string, url: string) => void;
  send: (id: string, text: string) => void;
  close: (id: string) => void;
  reset: () => void;
  notifications: (done: string, waiting: string) => void;
}

interface Frame {
  id: string;
  kind: "open" | "message" | "close";
  payload: string;
}

const bridge = (): LinkBridge | undefined =>
  (window as unknown as { AndroidLink?: LinkBridge }).AndroidLink;

const live = new Map<string, NativeSocket>();

let installed = false;
let opened = 0;

const install = () => {
  if (installed) return;
  installed = true;
  (window as unknown as { __cconnectLink?: (frame: Frame) => void }).__cconnectLink = (frame) =>
    live.get(frame.id)?.take(frame);
  bridge()?.reset();
};

class NativeSocket {
  readyState: number = WebSocket.CONNECTING;
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly #id: string;

  constructor(url: string) {
    install();
    this.#id = `${new URL(url).pathname}#${++opened}`;
    live.set(this.#id, this);
    bridge()?.open(this.#id, url);
  }

  send(text: string) {
    bridge()?.send(this.#id, text);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    live.delete(this.#id);
    bridge()?.close(this.#id);
  }

  take(frame: Frame) {
    if (frame.kind === "open") {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
      return;
    }
    if (frame.kind === "message") {
      this.onmessage?.({ data: frame.payload });
      return;
    }
    this.readyState = WebSocket.CLOSED;
    live.delete(this.#id);
    this.onclose?.({ code: 1006, reason: frame.payload });
  }
}

export const nativeSockets = (): boolean => bridge() !== undefined;

export const openSocket = (url: string, native: boolean): WebSocket =>
  native && nativeSockets() ? (new NativeSocket(url) as unknown as WebSocket) : new WebSocket(url);

export const nativeNotifications = (done: string, waiting: string) => {
  bridge()?.notifications(done, waiting);
};
