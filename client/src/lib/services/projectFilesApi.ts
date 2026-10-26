import { securityKeys } from "$lib/data/securityKeys.svelte";
import { authHeadersOf, backend, baseUrlOf, type Profile } from "./backend.svelte";
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

const PROJECTS = "/projects";
const FILE_ROUTE = "file";
const ARCHIVE_FILE_ROUTE = "archive-file";
const KEYED_ROUTES = [FILE_ROUTE, ARCHIVE_FILE_ROUTE];
const PATH_PARAM = "path";

const projectBase = (projectKey: string) => `${PROJECTS}/${encodeURIComponent(projectKey)}`;

export const projectFileUrl = (
  projectKey: string,
  path: string,
  profile: Profile = backend.active,
) => `${baseUrlOf(profile)}${projectBase(projectKey)}/${FILE_ROUTE}?${PATH_PARAM}=${encodeURIComponent(path)}`;

export const projectArchiveFileUrl = (
  projectKey: string,
  path: string,
  inner: string,
  profile: Profile = backend.active,
) =>
  `${baseUrlOf(profile)}${projectBase(projectKey)}/${ARCHIVE_FILE_ROUTE}?${PATH_PARAM}=${encodeURIComponent(path)}&inner=${encodeURIComponent(inner)}`;

const projectRouteOf = (url: string, profile: Profile): string | null => {
  const route = url.split("?")[0];
  return route.startsWith(`${baseUrlOf(profile)}${PROJECTS}/`) ? route.slice(route.lastIndexOf("/") + 1) : null;
};

export const fileHeaders = (url: string, profile: Profile): Record<string, string> => ({
  ...authHeadersOf(profile),
  ...(KEYED_ROUTES.includes(projectRouteOf(url, profile) ?? "") ? securityKeys.headersFor(profile) : {}),
});

export const projectFolderUrl = (url: string, profile: Profile = backend.active): string | null => {
  if (projectRouteOf(url, profile) !== FILE_ROUTE) return null;
  const [route, query] = url.split("?");
  const path = new URLSearchParams(query).get(PATH_PARAM) ?? "";
  return `${route}?${PATH_PARAM}=${encodeURIComponent(path.slice(0, path.lastIndexOf("/") + 1))}`;
};

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

  async archive(projectKey: string, path: string, inner = ""): Promise<ProjectEntry[] | null> {
    const data = await client.get<Wire[]>(`${projectBase(projectKey)}/archive`, { path, inner });
    return Array.isArray(data) ? data.map(parseEntry) : null;
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
