import { backend, socketUrlOf, type Profile } from "./backend.svelte";

export interface SocketHandlers {
  onOpen?: () => void;
  onMessage: (data: Record<string, unknown>) => void;
  onDrop?: () => void;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_SHIFT = 4;
const MILLIS_PER_SECOND = 1000;

export class ReconnectingSocket {
  #socket: WebSocket | null = null;
  #generation = 0;
  #attempts = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;

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
    this.#open();
  }

  send(payload: unknown) {
    if (this.#socket?.readyState === WebSocket.OPEN) this.#socket.send(JSON.stringify(payload));
  }

  close() {
    this.#closed = true;
    this.#clearTimer();
    this.#stopPing();
    this.#generation++;
    this.#socket?.close(1000);
    this.#socket = null;
  }

  #clearTimer() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
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
    const socket = new WebSocket(url);
    this.#socket = socket;

    socket.onopen = () => {
      if (generation !== this.#generation) return;
      this.#attempts = 0;
      this.#startPing();
      this.handlers.onOpen?.();
    };
    socket.onmessage = (event) => {
      if (generation !== this.#generation) return;
      try {
        this.handlers.onMessage(JSON.parse(event.data as string));
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
    if (this.#closed || this.#timer !== null) return;
    this.handlers.onDrop?.();
    const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS << Math.min(this.#attempts, MAX_BACKOFF_SHIFT));
    this.#attempts++;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (!this.#closed) this.#open();
    }, backoff);
  }
}
