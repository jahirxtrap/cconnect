import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend } from "./backend.svelte";

interface MediaOptions {
  url: string;
  fallback?: string | null;
  transform?: (file: Blob) => Promise<Blob>;
  onerror?: () => void;
  onload?: () => void;
}

type Sourced = HTMLImageElement | HTMLMediaElement | HTMLIFrameElement | HTMLEmbedElement;

const fetchObjectUrl = async (url: string, transform?: (file: Blob) => Promise<Blob>) => {
  const response = await fetch(url, { headers: securityKeys.fileHeadersFor(backend.active) });
  if (!response.ok) throw new Error(String(response.status));
  const file = await response.blob();
  return URL.createObjectURL(transform ? await transform(file) : file);
};

export function mediaSrc(node: Sourced, options: MediaOptions) {
  let objectUrl: string | null = null;
  let token = 0;

  const release = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };

  const apply = async () => {
    const attempt = ++token;
    release();
    const sources = [options.url, options.fallback].filter(Boolean) as string[];
    for (const source of sources) {
      try {
        const resolved = await fetchObjectUrl(source, options.transform);
        if (attempt !== token) {
          URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved;
        node.src = resolved;
        if (node instanceof HTMLImageElement) await node.decode().catch(() => undefined);
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
    update(next: MediaOptions) {
      const moved = next.url !== options.url || next.fallback !== options.fallback;
      options = next;
      if (moved) void apply();
    },
    destroy() {
      token++;
      release();
    },
  };
}
