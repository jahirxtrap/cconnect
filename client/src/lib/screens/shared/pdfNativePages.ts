import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { EventBus, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { NativePdf, PdfRegion } from "$lib/platform/androidPdf";

const TILE = 1024;
const SEAM = 1;
const SINGLE_PIXELS = 4_000_000;
const BASE_PIXELS = 1_000_000;
const AHEAD_X = 0.25;
const AHEAD_Y = 0.5;
const NEAR_PAGES = 1;
const PAINT_INTERVAL_MS = 60;
const GESTURE_STEP = 1.5;
const GESTURE_AHEAD = 1.25;
const STEP_SLACK = 1e-6;
const PERCENT = 100;
const LAYER_CLASS = "pointer-events-none absolute inset-0";
const BOX_CLASS = "absolute overflow-hidden";
const IMAGE_CLASS = "absolute max-w-none select-none";
const LAYOUT_EVENTS = ["pagesinit", "pagerendered", "scalechanging", "updateviewarea"] as const;

interface Slot {
  box: HTMLDivElement;
  base: string;
  shown: string;
  baseImage: HTMLImageElement | null;
  full: number;
  tiles: Map<string, HTMLImageElement>;
  pending: Set<string>;
}

interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Gesture {
  factor: number;
  limit: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const sharpness = ({ factor, limit }: Gesture) =>
  factor < 1
    ? 1
    : Math.min(limit, GESTURE_STEP ** Math.ceil(Math.log(factor * GESTURE_AHEAD) / Math.log(GESTURE_STEP) - STEP_SLACK));

interface Sheet {
  index: number;
  div: HTMLDivElement;
  full: number;
  fullHeight: number;
}

const skipped = (): RenderTask =>
  ({ promise: Promise.resolve(), cancel: () => undefined, separateAnnots: false }) as unknown as RenderTask;

export const paintless = (document_: PDFDocumentProxy) => {
  const getPage = document_.getPage.bind(document_);
  document_.getPage = (number: number) =>
    getPage(number).then((page) => {
      page.render = skipped;
      return page;
    });
};

const percent = (part: number, whole: number) => `${(part / whole) * PERCENT}%`;

const decoded = (url: string, placement: string) => {
  const image = new Image();
  image.alt = "";
  image.draggable = false;
  image.className = IMAGE_CLASS;
  image.style.cssText = placement;
  image.src = url;
  return image.decode().then(() => image);
};

export const nativePages = (pdf: NativePdf, view: PDFViewer, eventBus: EventBus, container: HTMLElement, host: HTMLElement) => {
  const layer = document.createElement("div");
  layer.className = LAYER_CLASS;
  const slots = new Map<number, Slot>();
  const widths = new Map<number, number>();
  let generation = 0;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let gesture: Gesture | null = null;

  const pageDiv = (index: number) => view.getPageView(index)?.div as HTMLDivElement | undefined;

  const place = () => {
    frame = 0;
    if (layer.parentElement !== host) host.prepend(layer);
    for (const [index, slot] of slots) {
      const div = pageDiv(index);
      if (!div) continue;
      slot.box.style.left = `${div.offsetLeft}px`;
      slot.box.style.top = `${div.offsetTop}px`;
      slot.box.style.width = `${div.offsetWidth}px`;
      slot.box.style.height = `${div.offsetHeight}px`;
    }
  };

  const slotFor = (index: number) => {
    const known = slots.get(index);
    if (known) return known;
    const box = document.createElement("div");
    box.className = BOX_CLASS;
    layer.append(box);
    const slot: Slot = { box, base: "", shown: "", baseImage: null, full: 0, tiles: new Map(), pending: new Set() };
    slots.set(index, slot);
    return slot;
  };

  const drop = (index: number) => {
    slots.get(index)?.box.remove();
    slots.delete(index);
    widths.delete(index);
  };

  const paintBase = (slot: Slot, sheet: Sheet, pixels: number) => {
    const shrink = Math.min(1, Math.sqrt(pixels / (sheet.full * sheet.fullHeight)));
    const width = Math.max(1, Math.floor(sheet.full * shrink));
    const height = Math.max(1, Math.floor(sheet.fullHeight * shrink));
    const url = pdf.region({ page: sheet.index, full: width, x: 0, y: 0, width, height }, generation);
    if (slot.base.startsWith(`${width}x${height}|`)) return;
    slot.base = `${width}x${height}|${url}`;
    const key = slot.base;
    void decoded(url, "inset:0;width:100%;height:100%")
      .then((image) => {
        if (slot.base !== key) return;
        if (slot.baseImage) slot.baseImage.replaceWith(image);
        else slot.box.prepend(image);
        slot.baseImage = image;
        slot.shown = key;
        if (width === sheet.full) clearTiles(slot);
      })
      .catch(() => {
        if (slot.base === key) slot.base = "";
      });
  };

  const settleTiles = (slot: Slot) => {
    if (slot.pending.size) return;
    for (const [key, image] of slot.tiles) {
      if (!key.startsWith(`${slot.full}:`)) {
        image.remove();
        slot.tiles.delete(key);
      }
    }
  };

  const clearTiles = (slot: Slot) => {
    for (const image of slot.tiles.values()) image.remove();
    slot.tiles.clear();
    slot.pending.clear();
  };

  const paintTiles = (slot: Slot, sheet: Sheet, area: Area) => {
    slot.full = sheet.full;
    const ratioX = sheet.full / sheet.div.offsetWidth;
    const ratioY = sheet.fullHeight / sheet.div.offsetHeight;
    const startX = Math.max(0, (area.left - sheet.div.offsetLeft) * ratioX);
    const endX = Math.min(sheet.full, (area.right - sheet.div.offsetLeft) * ratioX);
    const startY = Math.max(0, (area.top - sheet.div.offsetTop) * ratioY);
    const endY = Math.min(sheet.fullHeight, (area.bottom - sheet.div.offsetTop) * ratioY);
    const wanted = new Set<string>();
    const queue: { key: string; region: PdfRegion; distance: number }[] = [];
    if (endX > startX && endY > startY) {
      const centerX = (startX + endX) / 2;
      const centerY = (startY + endY) / 2;
      for (let row = Math.floor(startY / TILE); row * TILE < endY; row++) {
        for (let column = Math.floor(startX / TILE); column * TILE < endX; column++) {
          const key = `${sheet.full}:${column}:${row}`;
          wanted.add(key);
          if (slot.tiles.has(key) || slot.pending.has(key)) continue;
          const x = column * TILE;
          const y = row * TILE;
          const width = Math.min(TILE + SEAM, sheet.full - x);
          const height = Math.min(TILE + SEAM, sheet.fullHeight - y);
          const distance = Math.hypot(x + width / 2 - centerX, y + height / 2 - centerY);
          queue.push({ key, region: { page: sheet.index, full: sheet.full, x, y, width, height }, distance });
        }
      }
    }
    for (const [key, image] of slot.tiles) {
      if (key.startsWith(`${sheet.full}:`) && !wanted.has(key)) {
        image.remove();
        slot.tiles.delete(key);
      }
    }
    queue.sort((first, second) => first.distance - second.distance);
    for (const { key, region } of queue) {
      slot.pending.add(key);
      const placement =
        `left:${percent(region.x, sheet.full)};top:${percent(region.y, sheet.fullHeight)};` +
        `width:${percent(region.width, sheet.full)};height:${percent(region.height, sheet.fullHeight)}`;
      void decoded(pdf.region(region, generation), placement)
        .then((image) => {
          if (!slot.pending.delete(key) || slot.full !== region.full) return;
          slot.box.append(image);
          slot.tiles.set(key, image);
        })
        .catch(() => {
          slot.pending.delete(key);
        })
        .finally(() => settleTiles(slot));
    }
    settleTiles(slot);
  };

  const shown = (): Area => {
    const left = container.scrollLeft;
    const top = container.scrollTop;
    const area = { left, top, right: left + container.clientWidth, bottom: top + container.clientHeight };
    if (!gesture) return area;
    const { factor, x, y, dx, dy } = gesture;
    return {
      left: x + (area.left - x - dx) / factor,
      right: x + (area.right - x - dx) / factor,
      top: y + (area.top - y - dy) / factor,
      bottom: y + (area.bottom - y - dy) / factor,
    };
  };

  const paint = () => {
    timer = null;
    place();
    const ratio = (window.devicePixelRatio || 1) * (gesture ? sharpness(gesture) : 1);
    const area = shown();
    const width = area.right - area.left;
    const height = area.bottom - area.top;
    const reach: Area = gesture
      ? area
      : {
          left: area.left - width * AHEAD_X,
          right: area.right + width * AHEAD_X,
          top: area.top - height * AHEAD_Y,
          bottom: area.bottom + height * AHEAD_Y,
        };
    const visible: number[] = [];
    for (let index = 0; index < view.pagesCount; index++) {
      const div = pageDiv(index);
      if (div && div.offsetTop + div.offsetHeight > area.top && div.offsetTop < area.bottom) visible.push(index);
    }
    if (!visible.length) return;
    const first = Math.max(0, visible[0] - NEAR_PAGES);
    const last = Math.min(view.pagesCount - 1, visible[visible.length - 1] + NEAR_PAGES);
    for (const index of [...slots.keys()]) if (index < first || index > last) drop(index);
    const sheets: Sheet[] = [];
    for (let index = first; index <= last; index++) {
      const div = pageDiv(index);
      if (div?.offsetWidth && div.offsetHeight) {
        sheets.push({ index, div, full: Math.round(div.offsetWidth * ratio), fullHeight: Math.round(div.offsetHeight * ratio) });
      }
    }
    if (sheets.some((sheet) => widths.has(sheet.index) && widths.get(sheet.index) !== sheet.full)) {
      generation += 1;
      pdf.focus(generation);
    }
    for (const sheet of sheets) {
      widths.set(sheet.index, sheet.full);
      const slot = slotFor(sheet.index);
      if (sheet.full * sheet.fullHeight <= SINGLE_PIXELS) {
        paintBase(slot, sheet, SINGLE_PIXELS);
        if (slot.shown === slot.base && slot.base.startsWith(`${sheet.full}x`)) clearTiles(slot);
        continue;
      }
      paintBase(slot, sheet, BASE_PIXELS);
      paintTiles(slot, sheet, reach);
    }
    place();
  };

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place);
    if (timer === null) timer = setTimeout(paint, PAINT_INTERVAL_MS);
  };

  for (const name of LAYOUT_EVENTS) eventBus.on(name, schedule);
  const resizing = new ResizeObserver(schedule);
  resizing.observe(container);

  return {
    follow(next: Gesture | null) {
      gesture = next;
      if (next) {
        schedule();
        return;
      }
      if (timer !== null) clearTimeout(timer);
      timer = null;
      paint();
    },
    destroy() {
      for (const name of LAYOUT_EVENTS) eventBus.off(name, schedule);
      resizing.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      layer.remove();
      slots.clear();
      pdf.close();
    },
  };
};
