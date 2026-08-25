export type PreviewKind = "image" | "markdown" | "html" | "text" | "pdf" | "video" | "audio" | "none";

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

const TEXT_APPLICATION_MIMES = [
  "application/json",
  "application/xml",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
  "application/sql",
  "application/x-bat",
];

const TEXT_FALLBACK_EXTENSIONS = [
  "kt",
  "kts",
  "gradle",
  "toml",
  "ini",
  "cfg",
  "conf",
  "properties",
  "env",
  "yml",
  "yaml",
  "ts",
  "tsx",
  "jsx",
  "rs",
  "go",
  "ps1",
  "diff",
  "patch",
  "log",
  "lock",
];

export const extensionOf = (filename: string): string => {
  const name = filename.split(/[?#]/)[0];
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index + 1).toLowerCase();
};

export const guessMimeType = (filename: string): string | null =>
  MIME_BY_EXTENSION[extensionOf(filename)] ?? null;

export const previewKindOf = (filename: string): PreviewKind => {
  const extension = extensionOf(filename);
  if (MARKDOWN_EXTENSIONS.includes(extension)) return "markdown";
  const mime = guessMimeType(filename);
  if (mime === "text/html") return "html";
  if (mime === "application/pdf") return "pdf";
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime?.startsWith("text/")) return "text";
  if (mime && TEXT_APPLICATION_MIMES.includes(mime)) return "text";
  if (TEXT_FALLBACK_EXTENSIONS.includes(extension)) return "text";
  return "none";
};

export const isVideo = (filename: string): boolean => previewKindOf(filename) === "video";

export const isPreviewable = (filename: string): boolean => previewKindOf(filename) !== "none";
