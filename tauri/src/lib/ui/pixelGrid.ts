// Every length the chat lays out with goes through here, the way Compose runs dp through
// roundToPx(): the browser lays out in subpixels, so a value that falls between two physical
// pixels lets it round the blocks under it either way, and content jumps by a pixel whenever
// the list reflows. Rounding onto the device grid up front removes the choice.

const SNAPPED = [
  "--chat-gap-lg",
  "--chat-gap-sm",
  "--chat-line-dense",
  "--chat-line-code",
  "--chat-pad-xs",
];

let grid = 0;
const snapped = new Map<string, number>();

// Read from how a 1px border renders (0.8px at 125% scaling). devicePixelRatio is not usable
// for this: some window and DPI combinations report a flat 1 while the compositor is still
// painting on a 0.8 grid.
const measureGrid = (): number => {
  if (typeof document === "undefined") return 1;
  const probe = document.createElement("div");
  probe.style.cssText = "position:absolute;top:-9999px;left:0;width:10px;height:0;border-top:1px solid transparent";
  document.body.appendChild(probe);
  const rendered = probe.getBoundingClientRect().height;
  probe.remove();
  return rendered > 0 ? rendered : 1;
};

export const pixelGrid = (): number => grid || (grid = measureGrid());

/** Rounds a CSS length onto whole device pixels — the browser-side roundToPx(). */
export const snapPx = (value: number): number => {
  // From the grid rather than devicePixelRatio, and cleaned up: the measurement carries float
  // noise (0.800000011920929), and 6 / that lands just under 7.5, flipping the rounding.
  const density = Math.round((1 / pixelGrid()) * 1000) / 1000;
  return Math.round(value * density) / density;
};

/** A snapped chat token, by its nominal custom-property name. */
export const snappedToken = (name: string, fallback: number): number => snapped.get(name) ?? fallback;

/** Re-reads the grid and republishes the tokens (the grid changes with the screen's scaling). */
export const refreshPixelGrid = (): number => {
  grid = measureGrid();
  const root = document.documentElement;
  const declared = getComputedStyle(root);
  root.style.setProperty("--px-grid", `${grid}px`);
  for (const name of SNAPPED) {
    const nominal = parseFloat(declared.getPropertyValue(name));
    if (!Number.isFinite(nominal)) continue;
    const value = snapPx(nominal);
    snapped.set(name, value);
    root.style.setProperty(`${name}-snap`, `${value}px`);
  }
  return grid;
};
