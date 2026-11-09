import { securityKeys } from "$lib/data/securityKeys.svelte";
import { serverSettings } from "$lib/data/serverSettings.svelte";
import { text as textOf, type Wire } from "$lib/data/wire";
import { backend, withToken } from "./backend.svelte";
import { createHttp, type HttpResult } from "./http";
import { imageCache } from "./imageCache.svelte";
import { sizedImage } from "./imageSize";
import { fetchBlob, fetchFile } from "./mediaSource";
import { ReconnectingSocket } from "./socket";

export interface ServerPack {
  id: string;
  name: string;
  version: string;
  author: string | null;
  preview: string | null;
  contents: Record<string, number>;
  file: string;
  modified: number;
}

const toPack = (raw: Wire): ServerPack | null => {
  const id = textOf(raw, "id");
  const file = textOf(raw, "file");
  if (!id || !file) return null;
  return {
    id,
    name: textOf(raw, "name") ?? id,
    version: textOf(raw, "version") ?? "",
    author: textOf(raw, "author"),
    preview: textOf(raw, "preview"),
    contents: (raw.contents as Record<string, number> | undefined) ?? {},
    file,
    modified: typeof raw.modified === "number" ? raw.modified : 0,
  };
};

class ServerPacks {
  entries = $state<ServerPack[]>([]);
  #watchers = 0;
  #socket = new ReconnectingSocket("/packs/ws", {
    onOpen: () => this.#socket.send({ type: "watch" }),
    onMessage: (message) => this.#apply(message),
  });

  readonly available = $derived(serverSettings.capabilities?.packSchema != null);

  watch(): () => void {
    if (this.#watchers++ === 0) this.#socket.connect();
    return () => {
      if (--this.#watchers > 0) return;
      this.#socket.close();
      this.entries = [];
    };
  }

  #apply(message: Wire) {
    if (message.type !== "snapshot") return;
    this.entries = ((message.packs as Wire[] | undefined) ?? []).flatMap((raw) => toPack(raw) ?? []);
    imageCache.drop(this.#previews, new Set(this.entries.map((pack) => this.previewKey(pack))));
  }

  urlOf(pack: ServerPack, suffix = ""): string {
    return withToken(`${backend.baseUrl}/packs/${encodeURIComponent(pack.file)}${suffix}`, backend.active);
  }

  get #previews(): string {
    return `${backend.baseUrl}/packs/`;
  }

  previewKey(pack: ServerPack): string {
    return `${this.#previews}${pack.file}?v=${pack.modified}`;
  }

  previewOf(pack: ServerPack, pixels: number): string | null {
    return imageCache.get(this.previewKey(pack), pixels);
  }

  loadPreview(pack: ServerPack, pixels: number) {
    const url = sizedImage(this.urlOf(pack, "/preview"), pixels);
    imageCache.load(this.previewKey(pack), () => fetchBlob(url), pixels);
  }

  download(pack: ServerPack): Promise<Blob | null> {
    return this.#blob(this.urlOf(pack));
  }

  fetchLink(url: string): Promise<Blob | null> {
    return this.#blob(withToken(`${backend.baseUrl}/packs/fetch?url=${encodeURIComponent(url)}`, backend.active));
  }

  async #blob(url: string): Promise<Blob | null> {
    try {
      const response = await fetchFile(url);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }

  remove(pack: ServerPack, key: string): Promise<HttpResult<unknown>> {
    const client = createHttp(
      () => backend.active,
      () => securityKeys.headers(key),
    );
    return client.call("DELETE", `/packs/${encodeURIComponent(pack.file)}`);
  }
}

export const serverPacks = new ServerPacks();

export const useServerPacks = () => {
  $effect(() => {
    void backend.activeId;
    serverSettings.ensure();
  });
  $effect(() => {
    void backend.activeId;
    if (serverPacks.available) return serverPacks.watch();
  });
};
