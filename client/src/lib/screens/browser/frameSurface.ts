interface FrameContext {
  drawImage(image: ImageBitmap, x: number, y: number, width: number, height: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
}

interface FrameSurface {
  width: number;
  height: number;
  getContext(kind: "2d"): FrameContext | null;
}

export const surfacePainter = (surface: FrameSurface, onPainted: () => void) => {
  let context: FrameContext | null = null;
  let announced = false;
  let closed = false;
  let decoding = false;
  let pending: ArrayBuffer | null = null;

  const paint = (bitmap: ImageBitmap) => {
    if (closed) return;
    const { width, height } = bitmap;
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
      context = surface.getContext("2d");
    }
    context ??= surface.getContext("2d");
    context?.drawImage(bitmap, 0, 0, width, height);
    if (announced) return;
    announced = true;
    onPainted();
  };

  const frame = (buffer: ArrayBuffer) => {
    if (decoding) {
      pending = buffer;
      return;
    }
    decoding = true;
    void createImageBitmap(new Blob([buffer], { type: "image/jpeg" }))
      .then((bitmap) => {
        paint(bitmap);
        bitmap.close();
      })
      .catch(() => undefined)
      .finally(() => {
        decoding = false;
        const next = pending;
        pending = null;
        if (next) frame(next);
      });
  };

  return {
    frame,
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
    },
  };
};
