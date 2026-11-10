import type { StreamInfo } from "$lib/services/browserSocket";

interface FrameContext {
  drawImage(image: CanvasImageSource, x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
}

interface FrameSurface {
  width: number;
  height: number;
  getContext(kind: "2d"): FrameContext | null;
}

export const JPEG_KIND = 0;
const KEY_KIND = 1;
const VIDEO_HEADER = 9;
const DECODE_BACKLOG = 4;

export const surfacePainter = (surface: FrameSurface, onPainted: () => void, onKeyNeeded: () => void) => {
  let context: FrameContext | null = null;
  let announced = false;
  let closed = false;
  let decoding = false;
  let pending: ArrayBuffer | null = null;
  let decoder: VideoDecoder | null = null;
  let info: StreamInfo | null = null;
  let awaitingKey = true;

  const paint = (image: CanvasImageSource, width: number, height: number) => {
    if (closed) return;
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
      context = surface.getContext("2d");
    }
    context ??= surface.getContext("2d");
    context?.drawImage(image, 0, 0, width, height);
    if (announced) return;
    announced = true;
    onPainted();
  };

  const still = (buffer: ArrayBuffer) => {
    if (decoding) {
      pending = buffer;
      return;
    }
    decoding = true;
    void createImageBitmap(new Blob([buffer], { type: "image/jpeg" }))
      .then((bitmap) => {
        paint(bitmap, bitmap.width, bitmap.height);
        bitmap.close();
      })
      .catch(() => undefined)
      .finally(() => {
        decoding = false;
        const next = pending;
        pending = null;
        if (next) still(next);
      });
  };

  const dropDecoder = () => {
    if (decoder && decoder.state !== "closed") decoder.close();
    decoder = null;
  };

  const needKey = () => {
    awaitingKey = true;
    onKeyNeeded();
  };

  const configure = () => {
    dropDecoder();
    if (closed || typeof VideoDecoder === "undefined" || !info?.codec) return;
    const current = new VideoDecoder({
      output: (video) => {
        paint(video, video.displayWidth, video.displayHeight);
        video.close();
      },
      error: () => {
        if (decoder === current) configure();
      },
    });
    current.configure({ codec: info.codec, codedWidth: info.width, codedHeight: info.height, optimizeForLatency: true });
    decoder = current;
    needKey();
  };

  const chunk = (kind: number, buffer: ArrayBuffer) => {
    if (!decoder || decoder.state !== "configured") return;
    if (awaitingKey && kind !== KEY_KIND) return;
    if (decoder.decodeQueueSize > DECODE_BACKLOG) {
      needKey();
      return;
    }
    awaitingKey = false;
    try {
      decoder.decode(
        new EncodedVideoChunk({
          type: kind === KEY_KIND ? "key" : "delta",
          timestamp: new DataView(buffer).getFloat64(1),
          data: new Uint8Array(buffer, VIDEO_HEADER),
        }),
      );
    } catch {
      configure();
    }
  };

  const frame = (buffer: ArrayBuffer) => {
    const kind = new Uint8Array(buffer, 0, 1)[0];
    if (kind === JPEG_KIND) still(buffer.slice(1));
    else chunk(kind, buffer);
  };

  const stream = (next: StreamInfo) => {
    info = next;
    configure();
  };

  return {
    frame,
    stream,
    clear: () => {
      announced = false;
      context ??= surface.getContext("2d");
      context?.clearRect(0, 0, surface.width, surface.height);
    },
    rearm: () => {
      announced = false;
    },
    close: () => {
      closed = true;
      dropDecoder();
    },
  };
};
