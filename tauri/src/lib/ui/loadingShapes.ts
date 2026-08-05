import { ACTIVE_INDICATOR_SCALE, MORPHS, SCALE_FACTOR } from "./loadingMorphs";

export const SHAPE_COUNT = MORPHS.length;

export const VIEW_BOX = 1 / (SCALE_FACTOR * ACTIVE_INDICATOR_SCALE);

export const pathOf = (index: number, progress: number): string => {
  const [start, end] = MORPHS[index % MORPHS.length];
  const points = new Array<number>(start.length);
  let minX = Number.MAX_VALUE;
  let maxX = -Number.MAX_VALUE;
  let minY = Number.MAX_VALUE;
  let maxY = -Number.MAX_VALUE;
  for (let position = 0; position < start.length; position += 2) {
    const x = start[position] + (end[position] - start[position]) * progress;
    const y = start[position + 1] + (end[position + 1] - start[position + 1]) * progress;
    points[position] = x;
    points[position + 1] = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const at = (position: number) =>
    (points[position] - (position % 2 === 0 ? centerX : centerY)).toFixed(4);
  let path = `M${at(0)} ${at(1)}`;
  for (let cubic = 0; cubic < points.length; cubic += 8) {
    path += `C${at(cubic + 2)} ${at(cubic + 3)} ${at(cubic + 4)} ${at(cubic + 5)} ${at(cubic + 6)} ${at(cubic + 7)}`;
  }
  return `${path}Z`;
};

const listeners = new Set<(elapsed: number) => void>();
let frame = 0;
let origin = 0;

const tick = (now: number) => {
  if (!origin) origin = now;
  const elapsed = now - origin;
  for (const listener of listeners) listener(elapsed);
  frame = listeners.size ? requestAnimationFrame(tick) : 0;
};

export const onFrame = (listener: (elapsed: number) => void) => {
  listeners.add(listener);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      origin = 0;
    }
  };
};
