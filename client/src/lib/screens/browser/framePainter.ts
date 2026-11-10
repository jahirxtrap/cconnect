import type { StreamInfo } from "$lib/services/browserSocket";
import { surfacePainter } from "./frameSurface";

export interface FramePainter {
  frame: (buffer: ArrayBuffer) => void;
  stream: (info: StreamInfo) => void;
  clear: () => void;
  rearm: () => void;
  capture: () => Promise<Blob | null>;
  close: () => void;
}

type Outbound = { op: "painted" } | { op: "keyframe" } | { op: "captured"; id: number; blob: Blob | null };

const workerPainter = (canvas: HTMLCanvasElement, onPainted: () => void, onKeyNeeded: () => void): FramePainter => {
  const worker = new Worker(new URL("./frameWorker.ts", import.meta.url), { type: "module" });
  let offscreen: OffscreenCanvas;
  try {
    offscreen = canvas.transferControlToOffscreen();
  } catch (error) {
    worker.terminate();
    throw error;
  }
  worker.postMessage({ op: "init", canvas: offscreen }, [offscreen]);
  const captures = new Map<number, (blob: Blob | null) => void>();
  let asked = 0;
  worker.onmessage = (event: MessageEvent<Outbound>) => {
    const message = event.data;
    if (message.op === "painted") {
      onPainted();
      return;
    }
    if (message.op === "keyframe") {
      onKeyNeeded();
      return;
    }
    captures.get(message.id)?.(message.blob);
    captures.delete(message.id);
  };
  return {
    frame: (buffer) => worker.postMessage({ op: "frame", buffer }),
    stream: (info) => worker.postMessage({ op: "stream", info }),
    clear: () => worker.postMessage({ op: "clear" }),
    rearm: () => worker.postMessage({ op: "rearm" }),
    capture: () =>
      new Promise((done) => {
        const id = ++asked;
        captures.set(id, done);
        worker.postMessage({ op: "capture", id });
      }),
    close: () => {
      for (const done of captures.values()) done(null);
      captures.clear();
      worker.terminate();
    },
  };
};

const mainPainter = (canvas: HTMLCanvasElement, onPainted: () => void, onKeyNeeded: () => void): FramePainter => ({
  ...surfacePainter(canvas, onPainted, onKeyNeeded),
  capture: () => new Promise((done) => canvas.toBlob(done, "image/png")),
});

export const framePainter = (canvas: HTMLCanvasElement, onPainted: () => void, onKeyNeeded: () => void): FramePainter => {
  if ("transferControlToOffscreen" in canvas && typeof Worker !== "undefined") {
    try {
      return workerPainter(canvas, onPainted, onKeyNeeded);
    } catch {
      return mainPainter(canvas, onPainted, onKeyNeeded);
    }
  }
  return mainPainter(canvas, onPainted, onKeyNeeded);
};
