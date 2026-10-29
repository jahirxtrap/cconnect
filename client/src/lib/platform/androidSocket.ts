interface LinkBridge {
  open: (id: string, url: string, agent: string) => void;
  send: (id: string, text: string) => void;
  describe: (id: string, subject: string) => void;
  close: (id: string) => void;
  reset: () => void;
  notifications: (done: string, waiting: string, claude: string) => void;
}

interface Frame {
  id: string;
  kind: "open" | "message" | "close" | "tap";
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
  (window as unknown as { __cconnectLink?: (frames: Frame[]) => void }).__cconnectLink = (frames) => {
    for (const frame of frames) live.get(frame.id)?.take(frame);
  };
  bridge()?.reset();
};

class NativeSocket {
  readyState: number = WebSocket.CONNECTING;
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  ontap: ((session: string) => void) | null = null;

  readonly #id: string;

  constructor(url: string, agent: string) {
    install();
    this.#id = `${new URL(url).pathname}#${++opened}`;
    live.set(this.#id, this);
    bridge()?.open(this.#id, url, agent);
  }

  send(text: string) {
    bridge()?.send(this.#id, text);
  }

  describe(subject: string) {
    bridge()?.describe(this.#id, subject);
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
    if (frame.kind === "tap") {
      this.ontap?.(frame.payload);
      return;
    }
    this.readyState = WebSocket.CLOSED;
    live.delete(this.#id);
    this.onclose?.({ code: 1006, reason: frame.payload });
  }
}

export const nativeSockets = (): boolean => bridge() !== undefined;

export const openSocket = (url: string, native: boolean, agent = ""): WebSocket =>
  native && nativeSockets() ? (new NativeSocket(url, agent) as unknown as WebSocket) : new WebSocket(url);

export const describeSocket = (socket: WebSocket | null, subject: string) => {
  if (socket instanceof NativeSocket) socket.describe(subject);
};

export const onSocketTap = (socket: WebSocket, onTap: (session: string) => void) => {
  if (socket instanceof NativeSocket) socket.ontap = onTap;
};

export const nativeNotifications = (done: string, waiting: string, claude: string) => {
  bridge()?.notifications(done, waiting, claude);
};
