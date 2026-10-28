import {
  toAgentFailure,
  toAgentSession,
  toCatalogAgent,
  toInstalledAgent,
  type AgentFailure,
  type AgentLogin,
  type AgentProtocol,
  type AgentSession,
  type CatalogAgent,
  type InstalledAgent,
} from "$lib/data/agentModels";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { baseUrlOf, withToken, type Profile } from "./backend.svelte";
import { createHttp, type HttpResult } from "./http";
import type { TerminalInfo } from "./terminalApi";

type Wire = Record<string, unknown>;

export const TASK_TOKEN = "{task}";
export const MODEL_TOKEN = "{model}";

export interface AgentList {
  agents: InstalledAgent[];
  node: boolean;
}

export interface AgentSessionPage {
  sessions: AgentSession[];
  next: string | null;
}

export interface CustomAgentFields {
  name: string;
  protocol: AgentProtocol;
  purpose: string;
  program: string;
  args: string[];
  edit_args: string[];
  bypass_args: string[];
  model_args: string[];
  env?: Record<string, string>;
}

export interface AgentChanges extends Partial<CustomAgentFields> {
  enabled?: boolean;
}

export type Outcome<T> =
  | { ok: true; status: number; value: T; failure: null }
  | { ok: false; status: number; value: null; failure: AgentFailure | null };

const outcome = <T>(result: HttpResult<Wire>, parse: (data: Wire) => T): Outcome<T> =>
  result.ok
    ? { ok: true, status: result.status, value: parse(result.data ?? {}), failure: null }
    : { ok: false, status: result.status, value: null, failure: toAgentFailure(result.data) };

const segment = (id: string) => encodeURIComponent(id);

export const createAgentsApi = (profile: () => Profile) => {
  const client = createHttp(profile);
  const keyed = (key: string) => createHttp(profile, () => securityKeys.headers(key));

  return {
    async list(): Promise<AgentList | null> {
      const data = await client.get<{ agents?: Wire[]; node?: boolean }>("/agents");
      return data ? { agents: (data.agents ?? []).map(toInstalledAgent), node: data.node === true } : null;
    },

    async catalog(): Promise<Outcome<CatalogAgent[]>> {
      return outcome(await client.call<Wire>("GET", "/agents/catalog"), (data) =>
        ((data.agents as Wire[] | undefined) ?? []).map(toCatalogAgent),
      );
    },

    catalogIconUrl(url: string): string {
      const target = profile();
      return withToken(`${baseUrlOf(target)}/agents/catalog/icon?url=${encodeURIComponent(url)}`, target);
    },

    iconUrl(id: string, version: string | null): string {
      const target = profile();
      const query = version ? `?v=${encodeURIComponent(version)}` : "";
      return withToken(`${baseUrlOf(target)}/agents/${segment(id)}/icon${query}`, target);
    },

    async install(id: string) {
      return outcome(await client.call<Wire>("POST", `/agents/${segment(id)}/install`, undefined, {}), toInstalledAgent);
    },

    async add(fields: CustomAgentFields, key: string) {
      return outcome(await keyed(key).call<Wire>("POST", "/agents", undefined, fields), toInstalledAgent);
    },

    async update(id: string, changes: AgentChanges, key: string) {
      return outcome(await keyed(key).call<Wire>("PATCH", `/agents/${segment(id)}`, undefined, changes), toInstalledAgent);
    },

    async remove(id: string) {
      return outcome(await client.call<Wire>("DELETE", `/agents/${segment(id)}`), () => true);
    },

    async env(id: string, key: string) {
      return outcome(await keyed(key).call<Wire>("GET", `/agents/${segment(id)}/env`), (data) =>
        Object.fromEntries(Object.entries((data.env as Wire | undefined) ?? {}).map(([name, value]) => [name, String(value)])),
      );
    },

    async log(id: string) {
      return outcome(await client.call<Wire>("GET", `/agents/${segment(id)}/log`), (data) =>
        Array.isArray(data.lines) ? data.lines.map(String) : [],
      );
    },

    async sessions(id: string, cwd: string, cursor: string | null = null) {
      return outcome(
        await client.call<Wire>("GET", `/agents/${segment(id)}/sessions`, { cwd, cursor: cursor ?? undefined }),
        (data): AgentSessionPage => ({
          sessions: ((data.sessions as Wire[] | undefined) ?? []).flatMap((item) => toAgentSession(item) ?? []),
          next: typeof data.next === "string" ? data.next : null,
        }),
      );
    },

    async forget(id: string, cwd: string, session: string) {
      return outcome(await client.call<Wire>("DELETE", `/agents/${segment(id)}/sessions`, { cwd, session }), () => true);
    },

    async loginPreview(id: string, method: string, cwd: string, key: string) {
      return outcome(
        await keyed(key).call<Wire>("GET", `/agents/${segment(id)}/login`, { method, cwd }),
        (data): AgentLogin => ({
          command: Array.isArray(data.command) ? data.command.map(String) : [],
          env: Object.fromEntries(Object.entries((data.env as Wire | undefined) ?? {}).map(([name, value]) => [name, String(value)])),
        }),
      );
    },

    async login(id: string, method: string, cwd: string, key: string) {
      return outcome(
        await keyed(key).call<Wire>("POST", `/agents/${segment(id)}/login`, undefined, { method, cwd }),
        (data) => data as unknown as TerminalInfo,
      );
    },
  };
};

export type AgentsApi = ReturnType<typeof createAgentsApi>;
