import { devicePixelRatio } from "svelte/reactivity/window";
import { withQuery } from "$lib/data/url";

const VECTOR_TYPE = "image/svg+xml";
const JPEG_TYPE = "image/jpeg";
const LOSSLESS_TYPE = "image/png";
const JPEG_QUALITY = 0.85;
const COVER_PARAM = "size";
const FIT_PARAM = "fit";
const RENDITION_PARAM = new RegExp(`([?&])(${COVER_PARAM}|${FIT_PARAM})=(\\d+)(&?)`);

export type ScaledSide = "short" | "long";

export interface Rendition {
  limit: number;
  side: ScaledSide;
}

export const devicePixels = (css: number) => Math.ceil(css * (devicePixelRatio.current ?? 1));

export const sizedImage = (url: string, pixels: number) => withQuery(url, COVER_PARAM, pixels);

export const fittedImage = (url: string, pixels: number) => withQuery(url, FIT_PARAM, pixels);

export const originalImage = (url: string) =>
  url.replace(RENDITION_PARAM, (_match, lead: string, _name, _limit, tail: string) => (tail ? lead : ""));

export const renditionOf = (url: string): Rendition | null => {
  const found = RENDITION_PARAM.exec(url);
  return found ? { limit: Number(found[3]), side: found[2] === COVER_PARAM ? "short" : "long" } : null;
};

const sideIn = (side: ScaledSide, width: number, height: number) =>
  side === "short" ? Math.min(width, height) : Math.max(width, height);

export const reducedIn = (rendition: Rendition | null, width: number, height: number) =>
  rendition !== null && sideIn(rendition.side, width, height) === rendition.limit;

export const fitsIn = (rendition: Rendition | null, width: number, height: number) =>
  rendition === null || sideIn(rendition.side, width, height) <= rendition.limit;

export const coversIn = (rendition: Rendition | null, width: number, height: number) =>
  rendition !== null && sideIn(rendition.side, width, height) >= rendition.limit;

export const isVector = (file: Blob) => file.type === VECTOR_TYPE;

export const vectorBlob = (source: string) => new Blob([source], { type: VECTOR_TYPE });

export const screenPixels = (bleed: number) =>
  devicePixels(Math.max(window.screen.width, window.screen.height) + bleed * 2);

const VIEW_BOX_SIZE = 4;

const encoded = (canvas: HTMLCanvasElement, type: string, fallback: Blob): Promise<Blob> =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? fallback), type, JPEG_QUALITY));

const vectorSize = (root: Element): [number, number] | null => {
  const absolute = (name: string) => {
    const value = root.getAttribute(name);
    return value && !value.includes("%") ? parseFloat(value) : Number.NaN;
  };
  const width = absolute("width");
  const height = absolute("height");
  if (width > 0 && height > 0) return [width, height];
  const box = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number) ?? [];
  return box.length === VIEW_BOX_SIZE && box[2] > 0 && box[3] > 0 ? [box[2], box[3]] : null;
};

const vectorStill = async (file: Blob, limit: number, side: ScaledSide, type: string | undefined): Promise<Blob> => {
  const svg = new DOMParser().parseFromString(await file.text(), VECTOR_TYPE);
  const root = svg.documentElement;
  const size = root.localName === "svg" ? vectorSize(root) : null;
  if (!size) return file;
  const [width, height] = size;
  const scale = limit / sideIn(side, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  if (!root.hasAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.setAttribute("width", String(canvas.width));
  root.setAttribute("height", String(canvas.height));
  const url = URL.createObjectURL(vectorBlob(new XMLSerializer().serializeToString(svg)));
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  return encoded(canvas, type ?? LOSSLESS_TYPE, file);
};

export const scaledImage = async (file: Blob, limit: number, side: ScaledSide = "short", type?: string): Promise<Blob> => {
  if (isVector(file)) return vectorStill(file, limit, side, type).catch(() => file);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const measured = sideIn(side, bitmap.width, bitmap.height);
  if (measured <= limit && !type) {
    bitmap.close();
    return file;
  }
  const scale = Math.min(1, limit / measured);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(bitmap.width * scale);
  canvas.height = Math.ceil(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return encoded(canvas, type ?? (file.type === JPEG_TYPE ? JPEG_TYPE : LOSSLESS_TYPE), file);
};

export const scaledUrl = (file: Blob, pixels: number | null, ready: (url: string) => void) => {
  let made: string | null = null;
  let cancelled = false;
  void (pixels ? scaledImage(file, pixels) : Promise.resolve(file)).then((blob) => {
    if (cancelled) return;
    made = URL.createObjectURL(blob);
    ready(made);
  });
  return () => {
    cancelled = true;
    if (made) URL.revokeObjectURL(made);
  };
};
