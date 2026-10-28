import { backend } from "./backend.svelte";
import { fileHeaders } from "./projectFilesApi";

export interface SourceOptions {
  url: string;
  fallback?: string | null;
  transform?: (file: Blob) => Promise<Blob>;
  onerror?: () => void;
  onload?: () => void;
}

type Sourced = HTMLImageElement | HTMLMediaElement | HTMLIFrameElement | HTMLEmbedElement;

export const fetchFile = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, cache: "no-cache", headers: fileHeaders(url, backend.sharedProfileOf(url)) });

export const fetchObjectUrl = async (url: string, transform?: (file: Blob) => Promise<Blob>) => {
  const response = await fetchFile(url);
  if (!response.ok) throw new Error(String(response.status));
  const file = await response.blob();
  return URL.createObjectURL(transform ? await transform(file) : file);
};

const revoke = (url: string) => URL.revokeObjectURL(url);

export const sourceAction = <O extends SourceOptions, T>(
  options: O,
  acquire: (url: string, options: O) => Promise<T>,
  place: (value: T) => Promise<void> | void,
  discard: (value: T) => void,
) => {
  let held: T | null = null;
  let token = 0;

  const release = () => {
    if (held !== null) discard(held);
    held = null;
  };

  const apply = async () => {
    const attempt = ++token;
    release();
    const sources = [options.url, options.fallback].filter(Boolean) as string[];
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
        return;
      } catch {
        continue;
      }
    }
    if (attempt === token) options.onerror?.();
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
