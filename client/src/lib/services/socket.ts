import { MILLIS_PER_SECOND } from "$lib/data/time";
import { nativeSockets, onSocketTap, openSocket } from "$lib/platform/androidSocket";
import { onWake } from "$lib/platform/wake";
import { backend, socketUrlOf, type Profile } from "./backend.svelte";

export interface SocketHandlers {
  onOpen?: () => void;
  onMessage: (data: Record<string, unknown>) => void;
  onBinary?: (data: ArrayBuffer) => void;
  onDrop?: () => void;
  onTap?: (session: string) => void;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_SHIFT = 4;

export const CONNECT_TIMEOUT_MS = 12_000;

const backoffFor = (attempts: number) =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS << Math.min(attempts, MAX_BACKOFF_SHIFT));

export class Redial {
  #attempts = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #handshake: ReturnType<typeof setTimeout> | null = null;
  #closed = true;
  #stopWake: (() => void) | null = null;

  constructor(
    private readonly open: () => void,
    private readonly wake: (stale: boolean) => void,
  ) {}

  get closed(): boolean {
    return this.#closed;
  }

  get waiting(): boolean {
    return this.#timer !== null;
  }

  start() {
    this.#closed = false;
    this.restart();
    this.#stopWake ??= onWake((stale) => {
      if (!this.#closed) this.wake(stale);
    });
    this.open();
  }

  restart() {
    this.#attempts = 0;
    this.#clearTimer();
  }

  dialing(socket: WebSocket, expired: () => void) {
    this.cancelDial();
    this.#handshake = setTimeout(() => {
      this.#handshake = null;
      if (socket.readyState !== WebSocket.OPEN) expired();
    }, CONNECT_TIMEOUT_MS);
  }

  cancelDial() {
    if (this.#handshake !== null) clearTimeout(this.#handshake);
    this.#handshake = null;
  }

  reached() {
    this.#attempts = 0;
    this.cancelDial();
  }

  later(): boolean {
    if (this.#closed || this.#timer !== null) return false;
    const backoff = backoffFor(this.#attempts);
    this.#attempts++;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#closed) this.open();
    }, backoff);
    return true;
  }

  stop() {
    this.#closed = true;
    this.#clearTimer();
    this.cancelDial();
    this.#stopWake?.();
    this.#stopWake = null;
  }

  #clearTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

export class ReconnectingSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #redial = new Redial(() => this.#open(), (stale) => this.#onWake(stale));

  #ping: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly path: string,
    private readonly handlers: SocketHandlers,
    private readonly profile: () => Profile = () => backend.active,
    private readonly pingSeconds = 0,
    private readonly native = false,
  ) {}

  connect() {
    this.#redial.start();
  }

  send(payload: unknown) {
    if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(payload));
  }

  close() {
    this.#redial.stop();
    this.#stopPing();
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
  }

  #onWake(stale: boolean) {
    const trusted = this.native && nativeSockets();
    if ((trusted || !stale) && this.#socket?.readyState === WebSocket.OPEN) return;
    this.#redial.restart();
    this.#open();
  }

  #stopPing() {
    if (this.#ping !== null) clearInterval(this.#ping);
    this.#ping = null;
  }

  #open() {
    const url = socketUrlOf(this.profile(), this.path);
    if (!url) return;
    const generation = ++this.#generation;
    this.#socket?.close();
    const socket = openSocket(url, this.native);
    socket.binaryType = "arraybuffer";
    onSocketTap(socket, (session) => this.handlers.onTap?.(session));
    this.#socket = socket;

    this.#redial.dialing(socket, () => {
      if (generation !== this.#generation) return;
      socket.close();
      this.#scheduleReopen();
    });

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#redial.reached();
      this.#startPing();
      this.handlers.onOpen?.();
    };
    socket.onmessage = (event) => {
      if (generation !== this.#generation) return;
      if (typeof event.data !== "string") {
        this.handlers.onBinary?.(event.data as ArrayBuffer);
        return;
      }
      try {
        this.handlers.onMessage(JSON.parse(event.data));
      } catch {
        return;
      }
    };
    socket.onclose = () => generation === this.#generation && this.#scheduleReopen();
    socket.onerror = () => generation === this.#generation && this.#scheduleReopen();
  }

  #startPing() {
    this.#stopPing();
    if (this.pingSeconds <= 0) return;
    const period = this.pingSeconds * MILLIS_PER_SECOND;
    this.#ping = setInterval(() => this.send({ type: "ping" }), period);
  }

  #scheduleReopen() {
    this.#stopPing();
    this.#redial.cancelDial();
    if (this.#redial.closed || this.#redial.waiting) return;
    this.handlers.onDrop?.();
    this.#redial.later();
  }
}
