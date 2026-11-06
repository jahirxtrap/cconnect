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

export interface GitCommit {
  hash: string;
  author: string;
  date: number;
  subject: string;
}

export interface GitResult {
  ok: boolean;
  output: string;
  head?: string;
  forbidden?: boolean;
}

const FORBIDDEN = 403;

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

const parseCommit = (raw: Wire): GitCommit => ({
  hash: raw.hash ?? "",
  author: raw.author ?? "",
  date: raw.date ?? 0,
  subject: raw.subject ?? "",
});

const parseResult = (raw: Wire | null): GitResult => ({
  ok: raw?.ok === true,
  output: raw?.output ?? "",
  head: raw?.head ?? "",
});

const gitBase = (projectKey: string) => `/git/${encodeURIComponent(projectKey)}`;

const write = async (client: HttpClient, path: string, body: unknown): Promise<GitResult> => {
  const answer = await client.call<Wire>("POST", path, undefined, body);
  return { ...parseResult(answer.data), forbidden: answer.status === FORBIDDEN };
};

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

  async log(projectKey: string, repo: string, before = ""): Promise<GitCommit[] | null> {
    const data = await client.get<Wire[]>(`${gitBase(projectKey)}/log`, { repo, before });
    return Array.isArray(data) ? data.map(parseCommit) : null;
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
    amend = false,
  ): Promise<string> {
    const data = await client.post<Wire>(`${gitBase(projectKey)}/message`, {
      repo,
      paths,
      note,
      amend,
    });
    return data?.message ?? "";
  },

  commit(projectKey: string, request: CommitRequest): Promise<GitResult> {
    return write(client, `${gitBase(projectKey)}/commit`, request);
  },

  revert(projectKey: string, repo: string, paths: string[]): Promise<GitResult> {
    return write(client, `${gitBase(projectKey)}/revert`, { repo, paths });
  },

  pull(projectKey: string, repo: string): Promise<GitResult> {
    return write(client, `${gitBase(projectKey)}/pull`, { repo });
  },

  push(projectKey: string, repo: string, force = false, upstream = false): Promise<GitResult> {
    return write(client, `${gitBase(projectKey)}/push`, { repo, force, upstream });
  },
});

export const gitApi = createGitApi(
  createHttp(
    () => backend.active,
    () => securityKeys.headersFor(backend.active),
  ),
);
