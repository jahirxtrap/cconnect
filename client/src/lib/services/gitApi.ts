import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend } from "./backend.svelte";
import { createHttp, type HttpClient } from "./http";

export interface GitRepo {
  path: string;
  name: string;
  relative: string;
  branch: string;
  detached: boolean;
  upstream: string;
  ahead: number;
  behind: number;
  remote: string;
}

export interface GitIdentity {
  name: string;
  email: string;
}

export interface GitIdentities {
  effective: GitIdentity;
  options: GitIdentity[];
}

export interface GitResult {
  ok: boolean;
  output: string;
  head?: string;
}

export interface CommitRequest {
  repo: string;
  paths: string[];
  message: string;
  author?: string;
  amend?: boolean;
}

type Wire = Record<string, any>;

const parseRepo = (raw: Wire): GitRepo => ({
  path: raw.path ?? "",
  name: raw.name ?? "",
  relative: raw.relative ?? "",
  branch: raw.branch ?? "",
  detached: raw.detached === true,
  upstream: raw.upstream ?? "",
  ahead: raw.ahead ?? 0,
  behind: raw.behind ?? 0,
  remote: raw.remote ?? "",
});

const parseIdentity = (raw: Wire): GitIdentity => ({ name: raw.name ?? "", email: raw.email ?? "" });

const parseResult = (raw: Wire | null): GitResult => ({
  ok: raw?.ok === true,
  output: raw?.output ?? "",
  head: raw?.head ?? "",
});

const gitBase = (projectKey: string) => `/git/${encodeURIComponent(projectKey)}`;

export const createGitApi = (client: HttpClient) => ({
  async repos(projectKey: string): Promise<GitRepo[] | null> {
    const data = await client.get<Wire[]>(`${gitBase(projectKey)}/repos`);
    return Array.isArray(data) ? data.map(parseRepo) : null;
  },

  async identities(projectKey: string, repo: string): Promise<GitIdentities | null> {
    const data = await client.get<Wire>(`${gitBase(projectKey)}/identities`, { repo });
    if (!data) return null;
    return {
      effective: parseIdentity(data.effective ?? {}),
      options: Array.isArray(data.options) ? data.options.map(parseIdentity) : [],
    };
  },

  async lastMessage(projectKey: string, repo: string): Promise<string> {
    const data = await client.get<Wire>(`${gitBase(projectKey)}/last-message`, { repo });
    return data?.message ?? "";
  },

  async suggestMessage(
    projectKey: string,
    repo: string,
    paths: string[],
    note = "",
  ): Promise<string> {
    const data = await client.post<Wire>(`${gitBase(projectKey)}/message`, { repo, paths, note });
    return data?.message ?? "";
  },

  async commit(projectKey: string, request: CommitRequest): Promise<GitResult> {
    return parseResult(await client.post<Wire>(`${gitBase(projectKey)}/commit`, request));
  },

  async revert(projectKey: string, repo: string, paths: string[]): Promise<GitResult> {
    return parseResult(await client.post<Wire>(`${gitBase(projectKey)}/revert`, { repo, paths }));
  },

  async pull(projectKey: string, repo: string): Promise<GitResult> {
    return parseResult(await client.post<Wire>(`${gitBase(projectKey)}/pull`, { repo }));
  },

  async push(projectKey: string, repo: string, force = false, upstream = false): Promise<GitResult> {
    return parseResult(await client.post<Wire>(`${gitBase(projectKey)}/push`, { repo, force, upstream }));
  },
});

export const gitApi = createGitApi(
  createHttp(
    () => backend.active,
    () => securityKeys.headersFor(backend.active),
  ),
);
