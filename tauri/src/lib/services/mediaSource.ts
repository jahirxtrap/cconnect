import { authHeadersOf, backend } from "./backend.svelte";

interface MediaOptions {
  url: string;
  fallback?: string | null;
  onerror?: () => void;
  onload?: () => void;
}

type Sourced = HTMLImageElement | HTMLMediaElement | HTMLIFrameElement | HTMLEmbedElement;

const fetchObjectUrl = async (url: string) => {
  const response = await fetch(url, { headers: authHeadersOf(backend.active) });
  if (!response.ok) throw new Error(String(response.status));
  return URL.createObjectURL(await response.blob());
};

export function mediaSrc(node: Sourced, options: MediaOptions) {
  let objectUrl: string | null = null;
  let token = 0;

  const release = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };

  const apply = async (current: MediaOptions) => {
    const attempt = ++token;
    release();
    const sources = [current.url, current.fallback].filter(Boolean) as string[];
    for (const source of sources) {
      try {
        const resolved = await fetchObjectUrl(source);
        if (attempt !== token) {
          URL.revokeObjectURL(resolved);
          return;
        }
        objectUrl = resolved;
        node.src = resolved;
        if (node instanceof HTMLImageElement) await node.decode().catch(() => undefined);
        if (attempt !== token) return;
        current.onload?.();
        return;
      } catch {
        continue;
      }
    }
    if (attempt === token) current.onerror?.();
  };

  void apply(options);

  return {
    update(next: MediaOptions) {
      options = next;
      void apply(next);
    },
    destroy() {
      token++;
      release();
    },
  };
}
