import type { StreamInfo } from "$lib/services/browserSocket";
import { surfacePainter } from "./frameSurface";

type Inbound =
  | { op: "init"; canvas: OffscreenCanvas }
  | { op: "frame"; buffer: ArrayBuffer }
  | { op: "stream"; info: StreamInfo }
  | { op: "clear" }
  | { op: "rearm" }
  | { op: "capture"; id: number };

const scope = self as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<Inbound>) => void) | null;
};

let canvas: OffscreenCanvas | null = null;
let painter: ReturnType<typeof surfacePainter> | null = null;

const capture = async (id: number) => {
  const blob = canvas ? await canvas.convertToBlob({ type: "image/png" }).catch(() => null) : null;
  scope.postMessage({ op: "captured", id, blob });
};

scope.onmessage = (event) => {
  const message = event.data;
  if (message.op === "init") {
    canvas = message.canvas;
    painter = surfacePainter(
      canvas,
      () => scope.postMessage({ op: "painted" }),
      () => scope.postMessage({ op: "keyframe" }),
    );
  } else if (message.op === "frame") painter?.frame(message.buffer);
  else if (message.op === "stream") painter?.stream(message.info);
  else if (message.op === "clear") painter?.clear();
  else if (message.op === "rearm") painter?.rearm();
  else void capture(message.id);
};
