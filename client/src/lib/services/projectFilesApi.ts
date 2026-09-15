import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend, baseUrlOf, type Profile } from "./backend.svelte";
import { createHttp, type HttpClient } from "./http";

export interface ProjectEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number;
  items: number;
  status: string;
  ignored: boolean;
  repo: boolean;
  repoRoot: string;
  repoPath: string;
}

export interface ProjectDiff {
  added: number[];
  removed: Record<number, string[]>;
}

export interface ProjectListing {
  path: string;
  entries: ProjectEntry[];
  tracked: boolean;
  unlocked: boolean;
}

type Wire = Record<string, any>;

const parseEntry = (raw: Wire): ProjectEntry => ({
  name: raw.name ?? "",
  path: raw.path ?? "",
  isDir: raw.is_dir === true,
  size: raw.size ?? 0,
  modified: raw.modified ?? 0,
  items: raw.items ?? 0,
  status: raw.status ?? "",
  ignored: raw.ignored === true,
  repo: raw.repo === true,
  repoRoot: raw.repo_root ?? "",
  repoPath: raw.repo_path ?? "",
});

const projectBase = (projectKey: string) => `/projects/${encodeURIComponent(projectKey)}`;

export const projectFileUrl = (
  projectKey: string,
  path: string,
  profile: Profile = backend.active,
) => `${baseUrlOf(profile)}${projectBase(projectKey)}/file?path=${encodeURIComponent(path)}`;

export const createProjectFilesApi = (client: HttpClient) => ({
  async tree(projectKey: string, path = ""): Promise<ProjectListing | null> {
    const data = await client.get<Wire>(`${projectBase(projectKey)}/tree`, { path });
    if (!data) return null;
    return {
      path: data.path ?? "",
      entries: Array.isArray(data.entries) ? data.entries.map(parseEntry) : [],
      tracked: data.tracked === true,
      unlocked: data.unlocked === true,
    };
  },

  async search(projectKey: string, query: string): Promise<ProjectEntry[] | null> {
    const data = await client.get<Wire[]>(`${projectBase(projectKey)}/search`, { q: query });
    return Array.isArray(data) ? data.map(parseEntry) : null;
  },

  async changes(projectKey: string): Promise<ProjectEntry[] | null> {
    const data = await client.get<Wire[]>(`${projectBase(projectKey)}/changes`);
    return Array.isArray(data) ? data.map(parseEntry) : null;
  },

  async diff(projectKey: string, path: string): Promise<ProjectDiff | null> {
    const data = await client.get<Wire>(`${projectBase(projectKey)}/diff`, { path });
    if (!data) return null;
    return {
      added: Array.isArray(data.added) ? data.added : [],
      removed: (data.removed ?? {}) as Record<number, string[]>,
    };
  },
});

export const projectFilesApi = createProjectFilesApi(
  createHttp(
    () => backend.active,
    () => securityKeys.headersFor(backend.active),
  ),
);
