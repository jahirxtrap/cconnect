const LAYOUT_UNIT = 1 / 64;

const density = () => window.devicePixelRatio || 1;

const ceilToDevicePixel = (value: number) => {
  const scale = density();
  return Math.ceil((value - LAYOUT_UNIT / scale) * scale) / scale;
};

const floorToLayoutUnit = (value: number) => Math.max(0, Math.floor(value / LAYOUT_UNIT) * LAYOUT_UNIT);

export const snapToDevicePixel = (value: number) => {
  const scale = density();
  return Math.round(value * scale) / scale;
};

export const gridHeight = (node: HTMLElement) => {
  let pad = 0;
  const read = () => {
    const natural = node.getBoundingClientRect().height - pad;
    const next = floorToLayoutUnit(ceilToDevicePixel(natural) - natural);
    if (next === pad) return;
    pad = next;
    node.style.paddingBottom = pad ? `${pad}px` : "";
  };
  const observer = new ResizeObserver(read);
  observer.observe(node);
  read();
  return { destroy: () => observer.disconnect() };
};
