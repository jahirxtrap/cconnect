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

export const scaledImage = async (file: Blob, limit: number, side: ScaledSide = "short", type?: string): Promise<Blob> => {
  if (file.type === VECTOR_TYPE) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const measured = side === "short" ? Math.min(bitmap.width, bitmap.height) : Math.max(bitmap.width, bitmap.height);
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
  const encoded = type ?? (file.type === JPEG_TYPE ? JPEG_TYPE : LOSSLESS_TYPE);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), encoded, JPEG_QUALITY));
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
