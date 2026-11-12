import { judgeKey } from "$lib/data/keyGate.svelte";
import { securityKeys } from "$lib/data/securityKeys.svelte";
import { backend } from "./backend.svelte";
import { createHttp } from "./http";

export interface PtyInfo {
  backend: "pty" | "conpty" | "winpty";
  build: number | null;
}

export interface TerminalInfo {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  pty: PtyInfo | null;
  cols: number;
  rows: number;
  alive: boolean;
  busy: boolean;
  exit_status: number | null;
  created_at: number;
}

export interface TerminalRequest {
  cwd?: string[];
  title?: string;
  cols: number;
  rows: number;
}

const api = createHttp(() => backend.active, () => securityKeys.headersFor(backend.active));

export const listTerminals = async (key = securityKeys.current): Promise<TerminalInfo[] | null> => {
  const profile = backend.active;
  const result = await createHttp(() => profile, () => securityKeys.headers(key)).call<TerminalInfo[]>("GET", "/terminal/sessions");
  judgeKey(profile, key, result);
  return result.ok ? (result.data ?? []) : null;
};

export const openTerminal = (request: TerminalRequest) => api.post<TerminalInfo>("/terminal/sessions", request);

export const closeTerminal = (id: string) => api.delete(`/terminal/sessions/${id}`);
