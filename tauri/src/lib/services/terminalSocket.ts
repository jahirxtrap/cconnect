import type { TerminalHooks, TerminalLink } from "$lib/data/terminalLink";
import { backend, socketUrlOf } from "./backend.svelte";

const NO_LINK: TerminalLink = { send: () => {}, resize: () => {}, close: () => {} };

export const localLink = (
  sessionId: string,
  key: string,
  hooks: TerminalHooks,
  cols: number,
  rows: number,
): TerminalLink => {
  const url = socketUrlOf(backend.active, `/terminal/sessions/${sessionId}/ws`);
  if (!url) {
    hooks.onStatus("failed");
    return NO_LINK;
  }

  let attached = false;
  let disposed = false;
  let pending: [number, number] | null = null;
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  const post = (payload: unknown) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  };

  socket.onopen = () => post({ key, cols, rows });

  socket.onmessage = (event) => {
    if (typeof event.data !== "string") {
      hooks.onData(new Uint8Array(event.data as ArrayBuffer));
      return;
    }
    let payload: { type?: string };
    try {
      payload = JSON.parse(event.data) as { type?: string };
    } catch {
      return;
    }
    if (payload.type === "attached") {
      attached = true;
      hooks.onStatus("connected");
      if (pending) {
        post({ type: "resize", cols: pending[0], rows: pending[1] });
        pending = null;
      }
      return;
    }
    if (payload.type === "exit") hooks.onStatus("closed");
  };

  socket.onclose = () => {
    if (!disposed) hooks.onStatus(attached ? "closed" : "failed");
  };

  socket.onerror = () => {
    if (!disposed) hooks.onStatus("failed");
  };

  return {
    send: (data) => {
      if (attached && socket.readyState === WebSocket.OPEN) socket.send(data);
    },
    resize: (nextCols, nextRows) => {
      if (!attached) {
        pending = [nextCols, nextRows];
        return;
      }
      post({ type: "resize", cols: nextCols, rows: nextRows });
    },
    close: () => {
      disposed = true;
      socket.close(1000);
    },
  };
};
