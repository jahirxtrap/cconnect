const SNAPPED = [
  "--chat-gap-lg",
  "--chat-gap-sm",
  "--chat-line-dense",
  "--chat-line-code",
  "--chat-pad-xs",
];

let grid = 0;
const snapped = new Map<string, number>();

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

export const snapPx = (value: number): number => {
  const density = Math.round((1 / pixelGrid()) * 1000) / 1000;
  return Math.round(value * density) / density;
};

export const snappedToken = (name: string, fallback: number): number => snapped.get(name) ?? fallback;

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
