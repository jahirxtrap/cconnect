import { onWake } from "$lib/platform/wake";
import { backend, socketUrlOf, type Profile } from "./backend.svelte";

export interface SocketHandlers {
  onOpen?: () => void;
  onMessage: (data: Record<string, unknown>) => void;
  onBinary?: (data: ArrayBuffer) => void;
  onDrop?: () => void;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_SHIFT = 4;
const MILLIS_PER_SECOND = 1000;

export const CONNECT_TIMEOUT_MS = 12_000;

export const backoffFor = (attempts: number) =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS << Math.min(attempts, MAX_BACKOFF_SHIFT));

export class ReconnectingSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #attempts = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #handshake: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #stopWake: (() => void) | null = null;

  #ping: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly path: string,
    private readonly handlers: SocketHandlers,
    private readonly profile: () => Profile = () => backend.active,
    private readonly pingSeconds = 0,
  ) {}

  connect() {
    this.#closed = false;
    this.#attempts = 0;
    this.#clearTimer();
    this.#stopWake ??= onWake((stale) => this.#onWake(stale));
    this.#open();
  }

  send(payload: unknown) {
    if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(payload));
  }

  close() {
    this.#closed = true;
    this.#clearTimer();
    this.#clearHandshake();
    this.#stopPing();
    this.#stopWake?.();
    this.#stopWake = null;
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
  }

  #onWake(stale: boolean) {
    if (this.#closed) return;
    if (!stale && this.#socket?.readyState === WebSocket.OPEN) return;
    this.#attempts = 0;
    this.#clearTimer();
    this.#open();
  }

  #clearTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #clearHandshake() {
    if (this.#handshake !== null) clearTimeout(this.#handshake);
    this.#handshake = null;
  }

  #stopPing() {
    if (this.#ping !== null) clearInterval(this.#ping);
    this.#ping = null;
  }

  #open() {
    const url = socketUrlOf(this.profile(), this.path);
    if (!url) return;
    const generation = ++this.#generation;
    this.#clearHandshake();
    this.#socket?.close();
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    this.#socket = socket;

    this.#handshake = setTimeout(() => {
      this.#handshake = null;
      if (generation !== this.#generation || socket.readyState === WebSocket.OPEN) return;
      socket.close();
      this.#scheduleReopen();
    }, CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#attempts = 0;
      this.#clearHandshake();
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
    this.#clearHandshake();
    if (this.#closed || this.#timer !== null) return;
    this.handlers.onDrop?.();
    const backoff = backoffFor(this.#attempts);
    this.#attempts++;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#closed) this.#open();
    }, backoff);
  }
}
