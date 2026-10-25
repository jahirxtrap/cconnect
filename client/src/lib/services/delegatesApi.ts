import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend } from "./backend.svelte";
import { createHttp, type HttpClient } from "./http";

export const DELEGATE_KINDS = ["model", "claude", "command", "acp"] as const;
export const TASK_TOKEN = "{task}";
export const DELEGATE_TOOL = "delegate";

export type DelegateKind = (typeof DELEGATE_KINDS)[number];

export interface DelegateArgs {
  args: string[];
  editArgs: string[];
  bypassArgs: string[];
}

export interface Delegate extends DelegateArgs {
  id: string;
  name: string;
  kind: DelegateKind;
  description: string;
  account: string | null;
  command: string | null;
  enabled: boolean;
}

export interface DelegatePreset extends DelegateArgs {
  kind: DelegateKind;
  name: string;
  command: string;
}

export interface Delegates {
  delegates: Delegate[];
  presets: DelegatePreset[];
}

type Wire = Record<string, unknown>;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

const kindOf = (value: unknown): DelegateKind =>
  DELEGATE_KINDS.find((kind) => kind === value) ?? "model";

const argsOf = (raw: Wire): DelegateArgs => ({
  args: strings(raw.args),
  editArgs: strings(raw.edit_args),
  bypassArgs: strings(raw.bypass_args),
});

const delegateOf = (raw: Wire): Delegate => ({
  id: String(raw.id ?? ""),
  name: String(raw.name ?? ""),
  kind: kindOf(raw.kind),
  description: String(raw.description ?? ""),
  account: typeof raw.account === "string" ? raw.account : null,
  command: typeof raw.command === "string" ? raw.command : null,
  ...argsOf(raw),
  enabled: raw.enabled !== false,
});

const presetOf = (raw: Wire): DelegatePreset => ({
  kind: kindOf(raw.kind),
  name: String(raw.name ?? ""),
  command: String(raw.command ?? ""),
  ...argsOf(raw),
});

const wireOf = ({ editArgs, bypassArgs, ...rest }: Delegate): Wire => ({
  ...rest,
  edit_args: editArgs,
  bypass_args: bypassArgs,
});

export const createDelegatesApi = (client: HttpClient) => ({
  async list(): Promise<Delegates | null> {
    const data = await client.get<{ delegates?: Wire[]; presets?: Wire[] }>("/delegates");
    if (!data) return null;
    return { delegates: (data.delegates ?? []).map(delegateOf), presets: (data.presets ?? []).map(presetOf) };
  },

  async save(delegates: Delegate[]): Promise<Delegate[] | null> {
    const data = await client.put<{ delegates?: Wire[] }>("/delegates", { delegates: delegates.map(wireOf) });
    return data ? (data.delegates ?? []).map(delegateOf) : null;
  },
});

export const delegatesApi = createDelegatesApi(
  createHttp(
    () => backend.active,
    () => securityKeys.headersFor(backend.active),
  ),
);
