import { securityKeys } from "$lib/data/securityKeys.svelte";
import { serverSettings } from "$lib/data/serverSettings.svelte";
import { backend, withToken } from "./backend.svelte";
import { createHttp, type HttpResult } from "./http";
import { fetchFile } from "./mediaSource";
import { ReconnectingSocket } from "./socket";

export interface ServerPack {
  id: string;
  name: string;
  version: string;
  author: string | null;
  preview: string | null;
  contents: Record<string, number>;
  file: string;
}

type Wire = Record<string, unknown>;

const textOf = (raw: Wire, key: string): string | null => (typeof raw[key] === "string" ? (raw[key] as string) : null);

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
  }

  urlOf(pack: ServerPack, suffix = ""): string {
    return withToken(`${backend.baseUrl}/packs/${encodeURIComponent(pack.file)}${suffix}`, backend.active);
  }

  async download(pack: ServerPack): Promise<Blob | null> {
    try {
      const response = await fetchFile(this.urlOf(pack));
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
