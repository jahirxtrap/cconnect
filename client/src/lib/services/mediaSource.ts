import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "$lib/platform";
import { backend, tokenOf, withToken } from "./backend.svelte";
import { fileHeaders } from "./projectFilesApi";
import { awaitSharedFile, followSharedFile } from "./sharedArrival.svelte";

export interface SourceOptions {
  url: string;
  fallback?: string | null;
  transform?: (file: Blob) => Promise<Blob>;
  onerror?: () => void;
  onload?: () => void;
}

type Sourced = HTMLImageElement | HTMLMediaElement | HTMLIFrameElement | HTMLEmbedElement;

export const fetchFile = (url: string, init: RequestInit = {}, extra: Record<string, string> = {}) =>
  fetch(url, { ...init, cache: "no-cache", headers: { ...fileHeaders(url, backend.sharedProfileOf(url)), ...extra } });

const NOT_FOUND = 404;
const RANGE_NOT_SATISFIABLE = 416;
const FIRST_BYTE = { Range: "bytes=0-0" };
const VERSION_HEADERS = ["etag", "last-modified"];
const AUTHORIZATION = "Authorization";
const IMAGE_FAILED = "image failed to load";

export class MissingFile extends Error {}

export const fetchBlob = async (url: string) => {
  const response = await fetchFile(url);
  if (response.status === NOT_FOUND) throw new MissingFile(url);
  if (!response.ok) throw new Error(String(response.status));
  const file = await response.blob();
  if (!file.size) throw new MissingFile(url);
  return file;
};

export const fetchObjectUrl = async (url: string, transform?: (file: Blob) => Promise<Blob>) => {
  const file = await fetchBlob(url);
  return URL.createObjectURL(transform ? await transform(file) : file);
};

const revoke = (url: string) => URL.revokeObjectURL(url);

const probeFile = async (url: string) => {
  const response = await fetchFile(url, {}, FIRST_BYTE);
  void response.body?.cancel();
  if (response.status === NOT_FOUND || response.status === RANGE_NOT_SATISFIABLE) throw new MissingFile(url);
  if (!response.ok) throw new Error(String(response.status));
  return VERSION_HEADERS.map((name) => response.headers.get(name)).find(Boolean) ?? crypto.randomUUID();
};

const versioned = (url: string, version: string) =>
  `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;

export interface ServedFile {
  src: string;
  close: () => void;
}

export const serveFile = async (url: string): Promise<ServedFile> => {
  const profile = backend.sharedProfileOf(url);
  const headers = fileHeaders(url, profile);
  const unsent = Object.keys(headers).filter((name) => !(name === AUTHORIZATION && tokenOf(profile)));
  if (!isTauri && unsent.length) {
    const src = await fetchObjectUrl(url);
    return { src, close: () => revoke(src) };
  }
  const target = versioned(url, await probeFile(url));
  if (!isTauri) return { src: withToken(target, profile), close: () => undefined };
  const id = crypto.randomUUID();
  const src = await invoke<string>("media_open", { id, url: target, headers });
  return { src, close: () => void invoke("media_close", { id }).catch(() => undefined) };
};

const closeServed = (served: ServedFile) => served.close();

const loaded = (node: HTMLImageElement) =>
  new Promise<void>((done, fail) => {
    const settled = new AbortController();
    const finish = (ok: boolean) => {
      settled.abort();
      if (ok) done();
      else fail(new Error(IMAGE_FAILED));
    };
    node.addEventListener("load", () => finish(true), { signal: settled.signal });
    node.addEventListener("error", () => finish(false), { signal: settled.signal });
  });

export const sourceAction = <O extends SourceOptions, T>(
  options: O,
  acquire: (url: string, options: O) => Promise<T>,
  place: (value: T) => Promise<void> | void,
  discard: (value: T) => void,
  prepare?: (value: T) => Promise<void>,
) => {
  let held: T | null = null;
  let token = 0;
  let waiting: (() => void) | null = null;
  let following: (() => void) | null = null;

  const release = () => {
    if (held !== null) discard(held);
    held = null;
    waiting?.();
    waiting = null;
    following?.();
    following = null;
  };

  const refresh = async (source: string, ready: (value: T) => Promise<void>) => {
    const attempt = ++token;
    let value: T;
    try {
      value = await acquire(source, options);
    } catch {
      return;
    }
    try {
      await ready(value);
    } catch {
      discard(value);
      return;
    }
    if (attempt !== token) {
      discard(value);
      return;
    }
    const previous = held;
    held = value;
    await Promise.resolve(place(value)).catch(() => undefined);
    if (previous !== null) discard(previous);
  };

  const follow = (source: string) => {
    if (prepare) following = followSharedFile(source, () => void refresh(source, prepare));
  };

  const apply = async () => {
    const attempt = ++token;
    release();
    const sources = [options.url, options.fallback].filter(Boolean) as string[];
    let missing = false;
    for (const source of sources) {
      try {
        const value = await acquire(source, options);
        if (attempt !== token) {
          discard(value);
          return;
        }
        held = value;
        await place(value);
        if (attempt !== token) return;
        options.onload?.();
        follow(source);
        return;
      } catch (error) {
        if (attempt !== token) return;
        if (held !== null) discard(held);
        held = null;
        missing ||= error instanceof MissingFile;
        continue;
      }
    }
    if (attempt !== token) return;
    options.onerror?.();
    if (missing) waiting = awaitSharedFile(options.url, () => void apply());
  };

  void apply();

  return {
    update(next: O) {
      const moved = next.url !== options.url || next.fallback !== options.fallback;
      options = next;
      if (moved) void apply();
    },
    destroy() {
      token++;
      release();
    },
  };
};

export function mediaSrc(node: Sourced, options: SourceOptions) {
  return sourceAction(
    options,
    (url, current) => fetchObjectUrl(url, current.transform),
    async (url) => {
      node.src = url;
      if (node instanceof HTMLImageElement) await node.decode().catch(() => undefined);
    },
    revoke,
  );
}

export function servedSrc(node: HTMLMediaElement | HTMLIFrameElement, options: SourceOptions) {
  return sourceAction(
    options,
    serveFile,
    (served) => {
      node.src = served.src;
    },
    closeServed,
  );
}

const decoded = (served: ServedFile) => {
  const next = new Image();
  next.src = served.src;
  return next.decode();
};

export function imageSrc(node: HTMLImageElement, options: SourceOptions) {
  return sourceAction(
    options,
    serveFile,
    (served) => {
      const done = loaded(node);
      node.src = served.src;
      return done;
    },
    closeServed,
    decoded,
  );
}

export function posterSrc(node: HTMLVideoElement, url: string | undefined) {
  const source = sourceAction(
    { url: url ?? "" },
    (resolved) => fetchObjectUrl(resolved),
    (resolved) => {
      node.poster = resolved;
    },
    revoke,
  );
  return {
    update: (next: string | undefined) => source.update({ url: next ?? "" }),
    destroy: source.destroy,
  };
}
