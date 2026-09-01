import { terminalKeys } from "$lib/data/terminalKeys.svelte";
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

const keyHeader = (): Record<string, string> =>
  terminalKeys.current ? { "X-Terminal-Key": terminalKeys.current } : {};

const api = createHttp(() => backend.active, keyHeader);

export const listTerminals = () => api.get<TerminalInfo[]>("/terminal/sessions");

export const listTerminalsWith = (key: string) =>
  createHttp(() => backend.active, () => ({ "X-Terminal-Key": key })).get<TerminalInfo[]>("/terminal/sessions");

export const openTerminal = (request: TerminalRequest) => api.post<TerminalInfo>("/terminal/sessions", request);

export const closeTerminal = (id: string) => api.delete(`/terminal/sessions/${id}`);
