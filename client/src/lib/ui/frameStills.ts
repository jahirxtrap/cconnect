import type { FramePainter } from "./framePainter";
import { JPEG_KIND } from "./frameSurface";

const STILL_TYPE = "image/jpeg";

const stills = new Map<string, Promise<ArrayBuffer | null>>();

const frameOf = async (blob: Blob | null) => (blob ? new Blob([new Uint8Array([JPEG_KIND]), blob]).arrayBuffer() : null);

export const keepStill = (key: string, painter: FramePainter) => {
  stills.set(key, painter.capture(STILL_TYPE).then(frameOf));
};

export const takeStill = (key: string): Promise<ArrayBuffer | null> => {
  const still = stills.get(key) ?? Promise.resolve(null);
  stills.delete(key);
  return still;
};
