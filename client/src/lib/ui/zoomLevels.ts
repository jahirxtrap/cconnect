export const ZOOM_LEVELS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export const ZOOM_NOTCH = 100;

export const zoomStep = (current: number, step: number): number | undefined =>
  step > 0 ? ZOOM_LEVELS.find((level) => level > current) : ZOOM_LEVELS.findLast((level) => level < current);
