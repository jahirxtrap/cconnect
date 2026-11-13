import { number, record, text, type Wire } from "$lib/data/wire";
import { createHttp } from "./http";
import { createProjectFilesApi, projectFileOf } from "./projectFilesApi";
import { createSharedApi, fileInfoServed, relativeFromUrl, servedProfileOf } from "./sharedApi";

export const MEDIA_TAGS = ["title", "artist", "album", "album_artist", "genre", "date", "track", "composer"] as const;

export type MediaTag = (typeof MEDIA_TAGS)[number];

export interface Location {
  latitude: number;
  longitude: number;
}

export interface ImageInfo {
  format: string | null;
  width: number | null;
  height: number | null;
  mode: string | null;
  frames: number | null;
  dpi: number | null;
  camera: string | null;
  lens: string | null;
  taken: string | null;
  exposure: number | null;
  aperture: number | null;
  iso: number | null;
  focalLength: number | null;
  software: string | null;
  location: Location | null;
}

export interface VideoStream {
  codec: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate: number | null;
}

export interface AudioStream {
  codec: string | null;
  sampleRate: number | null;
  channels: number | null;
  bitrate: number | null;
}

export interface MediaInfo {
  container: string | null;
  duration: number | null;
  bitrate: number | null;
  video: VideoStream | null;
  audio: AudioStream | null;
  tags: Partial<Record<MediaTag, string>>;
  cover: boolean;
}

export interface PdfInfo {
  pages: number | null;
  version: string | null;
  encrypted: boolean;
  title: string | null;
  author: string | null;
  subject: string | null;
  creator: string | null;
  producer: string | null;
  created: string | null;
  modified: string | null;
}

export interface FileInfo {
  size: number | null;
  modified: number | null;
  mime: string | null;
  image: ImageInfo | null;
  media: MediaInfo | null;
  pdf: PdfInfo | null;
}

const section = (raw: Wire, key: string): Wire | null => (raw[key] ? record(raw, key) : null);

const toLocation = (raw: Wire | null): Location | null => {
  const latitude = raw ? number(raw, "latitude") : null;
  const longitude = raw ? number(raw, "longitude") : null;
  return latitude === null || longitude === null ? null : { latitude, longitude };
};

const toImage = (raw: Wire): ImageInfo => ({
  format: text(raw, "format"),
  width: number(raw, "width"),
  height: number(raw, "height"),
  mode: text(raw, "mode"),
  frames: number(raw, "frames"),
  dpi: number(raw, "dpi"),
  camera: text(raw, "camera"),
  lens: text(raw, "lens"),
  taken: text(raw, "taken"),
  exposure: number(raw, "exposure"),
  aperture: number(raw, "aperture"),
  iso: number(raw, "iso"),
  focalLength: number(raw, "focal_length"),
  software: text(raw, "software"),
  location: toLocation(section(raw, "location")),
});

const toVideo = (raw: Wire): VideoStream => ({
  codec: text(raw, "codec"),
  width: number(raw, "width"),
  height: number(raw, "height"),
  fps: number(raw, "fps"),
  bitrate: number(raw, "bitrate"),
});

const toAudio = (raw: Wire): AudioStream => ({
  codec: text(raw, "codec"),
  sampleRate: number(raw, "sample_rate"),
  channels: number(raw, "channels"),
  bitrate: number(raw, "bitrate"),
});

const toTags = (raw: Wire): Partial<Record<MediaTag, string>> => {
  const tags: Partial<Record<MediaTag, string>> = {};
  for (const tag of MEDIA_TAGS) {
    const value = text(raw, tag);
    if (value) tags[tag] = value;
  }
  return tags;
};

const toMedia = (raw: Wire): MediaInfo => {
  const video = section(raw, "video");
  const audio = section(raw, "audio");
  return {
    container: text(raw, "container"),
    duration: number(raw, "duration"),
    bitrate: number(raw, "bitrate"),
    video: video ? toVideo(video) : null,
    audio: audio ? toAudio(audio) : null,
    tags: toTags(record(raw, "tags")),
    cover: raw.cover === true,
  };
};

const toPdf = (raw: Wire): PdfInfo => ({
  pages: number(raw, "pages"),
  version: text(raw, "version"),
  encrypted: raw.encrypted === true,
  title: text(raw, "title"),
  author: text(raw, "author"),
  subject: text(raw, "subject"),
  creator: text(raw, "creator"),
  producer: text(raw, "producer"),
  created: text(raw, "created"),
  modified: text(raw, "modified"),
});

const toFileInfo = (raw: Wire): FileInfo => {
  const image = section(raw, "image");
  const media = section(raw, "media");
  const pdf = section(raw, "pdf");
  return {
    size: number(raw, "size"),
    modified: number(raw, "modified"),
    mime: text(raw, "mime"),
    image: image ? toImage(image) : null,
    media: media ? toMedia(media) : null,
    pdf: pdf ? toPdf(pdf) : null,
  };
};

const requestOf = (url: string): (() => Promise<Wire | null>) | null => {
  const profile = servedProfileOf(url);
  if (!profile) return null;
  const relative = relativeFromUrl(url, profile);
  if (relative !== null) {
    const api = createSharedApi(createHttp(() => profile));
    return () => api.info(relative);
  }
  const project = projectFileOf(url, profile);
  if (!project) return null;
  const api = createProjectFilesApi(() => profile);
  return () => api.info(project.project, project.path);
};

export const fileInfoAvailable = (url: string): boolean | undefined => {
  const served = fileInfoServed(url);
  return served === undefined ? undefined : served && requestOf(url) !== null;
};

export const loadFileInfo = async (url: string): Promise<FileInfo | null> => {
  const request = requestOf(url);
  const raw = request ? await request() : null;
  return raw ? toFileInfo(raw) : null;
};
