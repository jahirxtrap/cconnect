const SNAPPED = [
  "--chat-gap-lg",
  "--chat-gap-sm",
  "--chat-line-dense",
  "--chat-line-code",
  "--chat-pad-xs",
  "--chat-pager-gap",
];

const LAYOUT_UNIT = 1 / 64;

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

const densityOf = (): number => Math.round((1 / pixelGrid()) * 1000) / 1000;

const layoutUnit = (): number => LAYOUT_UNIT * pixelGrid();

const snapUnit = (value: number): number => {
  const unit = layoutUnit();
  return Math.round(value / unit) * unit;
};

export const snapPx = (value: number): number => {
  const density = densityOf();
  return Math.round(value * density) / density;
};

export const ceilPx = (value: number): number => {
  const density = densityOf();
  return Math.ceil((value - layoutUnit()) * density) / density;
};

export const snappedToken = (name: string, fallback: number): number => snapped.get(name) ?? fallback;

export const gridHeight = (node: HTMLElement, onChange?: (value: number) => void) => {
  let notify = onChange;
  let pad = 0;
  const read = () => {
    const natural = node.getBoundingClientRect().height - pad;
    const next = snapUnit(ceilPx(natural) - natural);
    if (next !== pad) {
      pad = next;
      node.style.paddingBottom = pad ? `${pad}px` : "";
    }
    notify?.(natural + pad);
  };
  const observer = new ResizeObserver(read);
  observer.observe(node);
  read();
  return {
    update(next?: (value: number) => void) {
      notify = next;
      read();
    },
    destroy() {
      observer.disconnect();
    },
  };
};

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
