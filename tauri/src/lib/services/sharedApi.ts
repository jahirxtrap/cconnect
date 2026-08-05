import { backend, baseUrlOf, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";

export interface SharedEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: number;
  items: number;
}

type Wire = Record<string, any>;

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const decodeSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const parseEntry = (raw: Wire): SharedEntry => ({
  name: raw.name ?? "",
  isDir: raw.is_dir === true,
  size: raw.size ?? 0,
  modified: raw.modified ?? 0,
  items: raw.items ?? 0,
});

export const sharedPrefix = (profile: Profile = backend.active) => `${baseUrlOf(profile)}/shared/`;

export const downloadUrl = (path: string, profile: Profile = backend.active) =>
  `${sharedPrefix(profile)}${encodePath(path)}`;

export const relativeFromUrl = (url: string, profile: Profile = backend.active): string | null => {
  const prefix = sharedPrefix(profile);
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length).split("?")[0].split("/").map(decodeSegment).join("/");
};

export const archiveFileUrl = (path: string, inner: string, profile: Profile = backend.active) =>
  `${baseUrlOf(profile)}/shared-archive-file?path=${encodeURIComponent(path)}&inner=${encodeURIComponent(inner)}`;

export const createSharedApi = (client: HttpClient) => ({
  async remove(path: string): Promise<boolean> {
    return (await client.delete(`/shared/${encodePath(path)}`)) !== null;
  },

  async search(path: string, query: string): Promise<SharedEntry[] | null> {
    const data = await client.get<Wire[]>("/shared-search", { q: query, path });
    return Array.isArray(data) ? data.map(parseEntry) : null;
  },

  async archiveList(path: string, inner = ""): Promise<SharedEntry[] | null> {
    const data = await client.get<Wire[]>("/shared-archive", { path, inner });
    return Array.isArray(data) ? data.map(parseEntry) : null;
  },

  async mkdir(path: string): Promise<boolean> {
    return (await client.post("/shared/folder", { path })) !== null;
  },

  async rename(path: string, name: string): Promise<boolean> {
    return (await client.post("/shared/rename", { path, name })) !== null;
  },

  async absolutePaths(paths: string[]): Promise<string[] | null> {
    const data = await client.post<string[]>("/shared/paths", { paths });
    return Array.isArray(data) ? data : null;
  },

  async move(paths: string[], dest: string): Promise<boolean> {
    return (await client.post("/shared/move", { paths, dest })) !== null;
  },

  async copy(paths: string[], dest: string): Promise<boolean> {
    return (await client.post("/shared/copy", { paths, dest })) !== null;
  },

  async compressFormats(): Promise<string[] | null> {
    const data = await client.get<Wire>("/shared-capabilities");
    return data?.compress_formats ?? null;
  },

  async compress(paths: string[], format = "zip", name: string | null = null): Promise<boolean> {
    return (
      (await client.post("/shared/compress", { paths, format, ...(name ? { name } : {}) })) !== null
    );
  },

  async extract(
    path: string,
    options: { dest?: string; intoFolder?: boolean; members?: string[] | null; base?: string } = {},
  ): Promise<boolean> {
    return (
      (await client.post("/shared/extract", {
        path,
        ...(options.dest === undefined ? {} : { dest: options.dest }),
        into_folder: options.intoFolder ?? true,
        ...(options.members ? { members: options.members } : {}),
        ...(options.base ? { base: options.base } : {}),
      })) !== null
    );
  },
});

export const sharedApi = createSharedApi(http);
