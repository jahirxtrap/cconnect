export const LAYOUT_UNIT = 1 / 64;

const density = () => window.devicePixelRatio || 1;

const ceilToDevicePixel = (value: number) => {
  const scale = density();
  return Math.ceil((value - LAYOUT_UNIT / scale) * scale) / scale;
};

const floorToDevicePixel = (value: number) => {
  const scale = density();
  return Math.floor((value + LAYOUT_UNIT / scale) * scale) / scale;
};

const roundToLayoutUnit = (value: number) => {
  const unit = LAYOUT_UNIT / density();
  return Math.max(0, Math.round(value / unit) * unit);
};

export const snapToDevicePixel = (value: number) => {
  const scale = density();
  return Math.round(value * scale) / scale;
};

export const gridHeight = (node: HTMLElement) => {
  let pad = 0;
  const read = () => {
    const natural = node.getBoundingClientRect().height - pad;
    const next = roundToLayoutUnit(ceilToDevicePixel(natural) - natural);
    if (next === pad) return;
    pad = next;
    node.style.paddingBottom = pad ? `${pad}px` : "";
  };
  const observer = new ResizeObserver(read);
  observer.observe(node);
  read();
  return { destroy: () => observer.disconnect() };
};

export const gridWidth = (node: HTMLElement) => {
  const parent = node.parentElement;
  if (!parent) return {};
  const observer = new ResizeObserver(([entry]) => {
    node.style.width = `${floorToDevicePixel(entry.contentRect.width)}px`;
  });
  observer.observe(parent);
  return { destroy: () => observer.disconnect() };
};
