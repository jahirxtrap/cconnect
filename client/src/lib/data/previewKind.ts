import { isPackFile } from "$lib/design/packs/schema";
import { resolveLang } from "$lib/markdown/highlighter";
import { isArchive } from "./format";

export type PreviewKind = "image" | "markdown" | "html" | "text" | "pdf" | "video" | "audio";

export type FileKind = "image" | "video" | "audio" | "pdf" | "markdown" | "code" | "archive" | "pack" | "text";

export const FILE_KINDS: FileKind[] = [
  "image",
  "video",
  "audio",
  "pdf",
  "markdown",
  "code",
  "archive",
  "pack",
  "text",
];

const MARKDOWN_EXTENSIONS = ["md", "markdown"];

const MIME_BY_EXTENSION: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  text: "text/plain",
  css: "text/css",
  csv: "text/csv",
  xml: "text/xml",
  js: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
};

export const extensionOf = (filename: string): string => {
  const name = filename.split(/[?#]/)[0];
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
};

export const guessMimeType = (filename: string): string | null =>
  MIME_BY_EXTENSION[extensionOf(filename)] ?? null;

export const previewKindOf = (filename: string): PreviewKind => {
  if (MARKDOWN_EXTENSIONS.includes(extensionOf(filename))) return "markdown";
  const mime = guessMimeType(filename);
  if (mime === "text/html") return "html";
  if (mime === "application/pdf") return "pdf";
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  return "text";
};

const RENDERED_KINDS: PreviewKind[] = ["image", "video", "audio", "pdf", "html"];

export const isVideo = (filename: string): boolean => previewKindOf(filename) === "video";

export const readsAsText = (kind: PreviewKind): boolean => !RENDERED_KINDS.includes(kind);

export const isPreviewable = (filename: string): boolean =>
  MARKDOWN_EXTENSIONS.includes(extensionOf(filename)) || guessMimeType(filename) !== null;

export const fileKindOf = (filename: string): FileKind => {
  if (isPackFile(filename)) return "pack";
  if (isArchive(filename)) return "archive";
  const kind = previewKindOf(filename);
  if (kind === "markdown" || kind === "pdf" || kind === "image" || kind === "video" || kind === "audio") {
    return kind;
  }
  return kind === "html" || resolveLang(extensionOf(filename)) !== null ? "code" : "text";
};
