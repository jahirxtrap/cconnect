import { http, type HttpClient } from "./http";

export interface CliInfo {
  source: string;
  sources: string[];
  resolvedPath: string | null;
  activeVersion: string | null;
  bundledVersion: string | null;
  systemPath: string | null;
  systemVersion: string | null;
  customPath: string | null;
}

type Wire = Record<string, any>;

const DEFAULT_SOURCES = ["system", "custom", "bundled"];

const parse = (data: Wire): CliInfo => ({
  source: data.source ?? "system",
  sources: data.sources ?? DEFAULT_SOURCES,
  resolvedPath: data.resolved_path ?? null,
  activeVersion: data.active_version ?? null,
  bundledVersion: data.bundled_version ?? null,
  systemPath: data.system_path ?? null,
  systemVersion: data.system_version ?? null,
  customPath: data.custom_path ?? null,
});

export const createCliApi = (client: HttpClient) => ({
  async status(): Promise<CliInfo | null> {
    const data = await client.get<Wire>("/cli");
    return data && parse(data);
  },

  async setSource(source: string, customPath: string | null): Promise<CliInfo | null> {
    const data = await client.post<Wire>("/cli", {
      source,
      ...(customPath === null ? {} : { custom_path: customPath }),
    });
    return data && parse(data);
  },

  async update(source?: string, customPath?: string): Promise<{ ok: boolean; message: string }> {
    const data = await client.post<Wire>("/cli/update", {
      ...(source ? { source } : {}),
      ...(customPath ? { custom_path: customPath } : {}),
    });
    return { ok: data?.ok === true, message: data?.message ?? "" };
  },
});

export const cliApi = createCliApi(http);
