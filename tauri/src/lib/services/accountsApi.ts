import { transfers } from "$lib/data/transfers.svelte";
import { authHeadersOf, backend, baseUrlOf, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";

export interface AccountProvider {
  baseUrl: string;
  model: string;
}

export interface Account {
  id: string;
  label: string;
  loggedIn: boolean;
  primary: boolean;
  provider: AccountProvider | null;
}

export interface ProviderProbe {
  baseUrl: string;
  models: string[];
  found: boolean;
}

export interface AccountsSnapshot {
  accounts: Account[];
  default: string;
}

type Wire = Record<string, any>;

const parse = (data: Wire): Account => ({
  id: data.id ?? "",
  label: data.label ?? "",
  loggedIn: data.logged_in === true,
  primary: data.primary === true,
  provider: data.provider
    ? { baseUrl: data.provider.base_url ?? "", model: data.provider.model ?? "" }
    : null,
});

export const exportUrl = (id: string, profile: Profile = backend.active) =>
  `${baseUrlOf(profile)}/accounts/${encodeURIComponent(id)}/export`;

export const importUrl = (label: string, profile: Profile = backend.active) =>
  `${baseUrlOf(profile)}/accounts/import?label=${encodeURIComponent(label)}`;

export const createAccountsApi = (client: HttpClient) => ({
  async list(): Promise<AccountsSnapshot | null> {
    const data = await client.get<Wire>("/accounts");
    if (!data) return null;
    return { accounts: (data.accounts ?? []).map(parse), default: data.default ?? "" };
  },

  async create(label: string): Promise<Account | null> {
    const data = await client.post<Wire>("/accounts", { label });
    return data && parse(data);
  },

  async detectProvider(baseUrl = ""): Promise<ProviderProbe | null> {
    const query = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : "";
    const data = await client.get<Wire>(`/accounts/provider${query}`);
    if (!data) return null;
    return { baseUrl: data.base_url ?? "", models: data.models ?? [], found: data.found === true };
  },

  async createProvider(label: string, baseUrl: string): Promise<Account | null> {
    const data = await client.post<Wire>("/accounts/provider", { label, base_url: baseUrl });
    return data && parse(data);
  },

  async rename(id: string, label: string): Promise<boolean> {
    return (await client.put(`/accounts/${id}`, { label })) !== null;
  },

  async remove(id: string): Promise<boolean> {
    return (await client.delete(`/accounts/${id}`)) !== null;
  },

  async startLogin(id: string): Promise<string | null> {
    const data = await client.post<Wire>(`/accounts/${id}/login`);
    return data?.url ?? null;
  },

  async submitCode(id: string, code: string): Promise<boolean> {
    return (await client.post(`/accounts/${id}/login/code`, { code })) !== null;
  },

  async cancelLogin(id: string): Promise<void> {
    await client.delete(`/accounts/${id}/login`);
  },

  exportUrl,

  async importBundle(file: File, label: string): Promise<boolean> {
    return transfers.task("upload", file.name, async (_onProgress, signal) => {
      try {
        const response = await fetch(importUrl(label), {
          method: "POST",
          headers: authHeadersOf(backend.active),
          body: file,
          signal,
        });
        return response.ok;
      } catch {
        return false;
      }
    });
  },
});

export const accountsApi = createAccountsApi(http);
