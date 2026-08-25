// The scroll of an element only lands on whole device pixels, and that step is what any height
// change has to be a multiple of for the compensation to be exact. devicePixelRatio does not
// always report it — a window can paint at 125% while reporting 1 — so it is measured on the
// element itself: the smallest nudge that actually moves the scroll IS the step.
let measured = 0;

const PROBES = [0.05, 0.1, 0.125, 0.2, 0.25, 0.334, 0.4, 0.5, 0.667, 0.75, 0.8, 1];

export const measurePixelGrid = (element: HTMLElement) => {
  if (measured) return measured;
  const previous = element.scrollTop;
  const direction = previous > 0 ? -1 : 1;
  for (const probe of PROBES) {
    element.scrollTop = previous + direction * probe;
    const moved = Math.abs(element.scrollTop - previous);
    if (moved > 0.001) {
      measured = moved;
      break;
    }
  }
  element.scrollTop = previous;
  return measured || pixelGrid();
};

export const pixelGrid = () => measured || 1 / (window.devicePixelRatio || 1);
