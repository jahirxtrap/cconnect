import { invoke } from "@tauri-apps/api/core";
import { withQuery } from "$lib/data/url";
import { isTauri } from "$lib/platform";
import { backend, tokenOf, withToken } from "./backend.svelte";
import { coversIn, fitsIn, originalImage, reducedIn, renditionOf } from "./imageSize";
import { fileHeaders } from "./projectFilesApi";
import { relativeFromUrl } from "./sharedApi";
import { awaitSharedFile, followSharedFile } from "./sharedArrival.svelte";

export interface SourceOptions {
  url: string;
  borrow?: boolean;
  fallback?: string | null;
  transform?: (file: Blob) => Promise<Blob>;
  onerror?: () => void;
  onload?: () => void;
}

type Sourced = HTMLImageElement | HTMLMediaElement | HTMLIFrameElement | HTMLEmbedElement;

export const fetchFile = (url: string, init: RequestInit = {}, extra: Record<string, string> = {}) =>
  fetch(url, { ...init, cache: "no-cache", headers: { ...fileHeaders(url, backend.sharedProfileOf(url)), ...extra } }).catch(
    (error: unknown) => {
      throw error instanceof TypeError ? new UnreachableFile(url) : error;
    },
  );

const NOT_FOUND = 404;
const RANGE_NOT_SATISFIABLE = 416;
const FIRST_BYTE = { Range: "bytes=0-0" };
const VERSION_HEADERS = ["etag", "last-modified"];
const AUTHORIZATION = "Authorization";
const IMAGE_FAILED = "image failed to load";

export class MissingFile extends Error {}

export class UnreachableFile extends Error {}

export const arrivesLater = (error: unknown) => error instanceof MissingFile || error instanceof UnreachableFile;

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

const versioned = (url: string, version: string) => withQuery(url, "v", version);

type Freshness = "same" | "changed" | "gone";

const SAME: Promise<Freshness> = Promise.resolve("same");

const versions = new Map<string, string>();

const recheck = (url: string, known: string): Promise<Freshness> =>
  probeFile(url).then(
    (version): Freshness => {
      versions.set(url, version);
      return version === known ? "same" : "changed";
    },
    (error: unknown): Freshness => {
      if (!(error instanceof MissingFile)) return "same";
      versions.delete(url);
      return "gone";
    },
  );

const sharedFile = (url: string) => relativeFromUrl(url) !== null;

const fileOf = (url: string) => (sharedFile(url) ? originalImage(url) : url);

const renditionIn = (url: string) => (sharedFile(url) ? renditionOf(url) : null);

const versionOf = async (url: string, fresh: boolean) => {
  const file = fileOf(url);
  const known = fresh ? undefined : versions.get(file);
  if (known) return { version: known, freshness: recheck(file, known) };
  const version = await probeFile(file);
  versions.set(file, version);
  return { version, freshness: SAME };
};

export interface ServedFile {
  url: string;
  src: string;
  close: () => void;
  freshness: Promise<Freshness>;
}

export const serveFile = async (url: string, fresh = true): Promise<ServedFile> => {
  const profile = backend.sharedProfileOf(url);
  const headers = fileHeaders(url, profile);
  const unsent = Object.keys(headers).filter((name) => !(name === AUTHORIZATION && tokenOf(profile)));
  if (!isTauri && unsent.length) {
    const src = await fetchObjectUrl(url);
    return { url, src, close: () => revoke(src), freshness: SAME };
  }
  const { version, freshness } = await versionOf(url, fresh);
  const target = versioned(url, version);
  if (!isTauri) return { url, src: withToken(target, profile), close: () => undefined, freshness };
  const id = crypto.randomUUID();
  const src = await invoke<string>("media_open", { id, url: target, headers });
  return { url, src, close: () => void invoke("media_close", { id }).catch(() => undefined), freshness };
};

const serveRecalled = (url: string, _options: SourceOptions, fresh: boolean) => serveFile(url, fresh);

const freshnessOf = (served: ServedFile) => served.freshness;

const settled = async () => undefined;

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
  acquire: (url: string, options: O, fresh: boolean) => Promise<T>,
  place: (value: T) => Promise<void> | void,
  discard: (value: T) => void,
  prepare?: (value: T) => Promise<void>,
  freshness?: (value: T) => Promise<Freshness>,
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
      value = await acquire(source, options, true);
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
    let later = false;
    for (const source of sources) {
      try {
        const value = await acquire(source, options, false);
        if (attempt !== token) {
          discard(value);
          return;
        }
        held = value;
        await place(value);
        if (attempt !== token) return;
        options.onload?.();
        follow(source);
        void freshness?.(value).then((state) => {
          if (attempt !== token || state === "same") return;
          if (state === "gone") void apply();
          else void refresh(source, prepare ?? settled);
        });
        return;
      } catch (error) {
        if (attempt !== token) return;
        if (held !== null) discard(held);
        held = null;
        later ||= arrivesLater(error);
        continue;
      }
    }
    if (attempt !== token) return;
    options.onerror?.();
    if (later) waiting = awaitSharedFile(options.url, () => void apply());
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
    serveRecalled,
    (served) => {
      node.src = served.src;
    },
    closeServed,
    undefined,
    freshnessOf,
  );
}

const decoded = (served: ServedFile) => {
  const next = new Image();
  next.src = served.src;
  return next.decode();
};

interface Shown {
  url: string;
  src: string;
  width: number;
  height: number;
}

const shownImages = new Map<string, Map<HTMLImageElement, Shown>>();

const show = (node: HTMLImageElement, served: ServedFile) => {
  const file = fileOf(served.url);
  const holders = shownImages.get(file) ?? new Map<HTMLImageElement, Shown>();
  holders.set(node, { url: served.url, src: served.src, width: node.naturalWidth, height: node.naturalHeight });
  shownImages.set(file, holders);
};

const hide = (node: HTMLImageElement, src?: string) => {
  for (const [file, holders] of shownImages) {
    if (src !== undefined && holders.get(node)?.src !== src) continue;
    holders.delete(node);
    if (!holders.size) shownImages.delete(file);
  }
};

const paintedFor = (url: string, borrow: boolean): Shown | null => {
  const wanted = renditionIn(url);
  for (const shown of shownImages.get(fileOf(url))?.values() ?? []) {
    const whole = !reducedIn(renditionIn(shown.url), shown.width, shown.height);
    const same = whole && fitsIn(wanted, shown.width, shown.height);
    if (same || (borrow && (whole || coversIn(wanted, shown.width, shown.height)))) return shown;
  }
  return null;
};

export function imageSrc(node: HTMLImageElement, options: SourceOptions) {
  const reuse = (requested: SourceOptions): SourceOptions => {
    const shown = paintedFor(requested.url, requested.borrow === true);
    if (!shown) return requested;
    node.src = shown.src;
    if (node.complete && node.naturalWidth) requested.onload?.();
    return { ...requested, url: shown.url, fallback: null };
  };
  let requested = options;
  let effective = reuse(options);
  const action = sourceAction(
    effective,
    serveRecalled,
    (served) => {
      const done = loaded(node);
      node.src = served.src;
      return done.then(() => show(node, served));
    },
    (served) => {
      hide(node, served.src);
      closeServed(served);
    },
    decoded,
    freshnessOf,
  );
  return {
    update(next: SourceOptions) {
      const moved = next.url !== requested.url || next.fallback !== requested.fallback;
      requested = next;
      effective = moved ? reuse(next) : { ...next, url: effective.url, fallback: effective.fallback };
      action.update(effective);
    },
    destroy() {
      hide(node);
      action.destroy();
    },
  };
}
