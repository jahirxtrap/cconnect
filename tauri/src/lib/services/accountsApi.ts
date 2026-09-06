import { serverDefaults } from "$lib/data/serverDefaults.svelte";
import { transfers } from "$lib/data/transfers.svelte";
import { authHeadersOf, backend, baseUrlOf, type Profile } from "./backend.svelte";
import { http, type HttpClient } from "./http";

export type ProviderAuthKind = "none" | "bearer" | "api_key" | "basic" | "header";

export interface ProviderAuth {
  kind: ProviderAuthKind;
  token: string;
  user: string;
  password: string;
  headerName: string;
  headerValue: string;
}

export const emptyAuth = (): ProviderAuth => ({
  kind: "none",
  token: "",
  user: "",
  password: "",
  headerName: "",
  headerValue: "",
});

const authWire = (auth: ProviderAuth): Wire => ({
  kind: auth.kind,
  token: auth.token.trim(),
  user: auth.user.trim(),
  password: auth.password,
  header_name: auth.headerName.trim(),
  header_value: auth.headerValue.trim(),
});

export interface AccountProvider {
  baseUrl: string;
  model: string;
  contextScope: string;
}

export interface ProviderSettings extends AccountProvider {
  auth: ProviderAuth;
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

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
}

export interface AccountsSnapshot {
  accounts: Account[];
  default: string;
  providerUrl: string;
  presets: ProviderPreset[];
  scopes: string[];
}

type Wire = Record<string, any>;

const parse = (data: Wire): Account => ({
  id: data.id ?? "",
  label: data.label ?? "",
  loggedIn: data.logged_in === true,
  primary: data.primary === true,
  provider: data.provider
    ? {
        baseUrl: data.provider.base_url ?? "",
        model: data.provider.model ?? "",
        contextScope: data.provider.context_scope ?? "",
      }
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
    return {
      accounts: (data.accounts ?? []).map(parse),
      default: data.default ?? "",
      providerUrl: data.provider_url ?? "",
      presets: (data.provider_presets ?? []).map((preset: Wire) => ({
        id: preset.id ?? "",
        label: preset.label ?? "",
        baseUrl: preset.base_url ?? "",
      })),
      scopes: data.provider_scopes ?? [],
    };
  },

  async create(label: string): Promise<Account | null> {
    const data = await client.post<Wire>("/accounts", { label });
    if (data) serverDefaults.bump();
    return data && parse(data);
  },

  async detectProvider(baseUrl = "", auth = emptyAuth()): Promise<ProviderProbe | null> {
    const data = await client.post<Wire>("/accounts/provider/probe", {
      base_url: baseUrl,
      auth: authWire(auth),
    });
    if (!data) return null;
    return { baseUrl: data.base_url ?? "", models: data.models ?? [], found: data.found === true };
  },

  async provider(id: string): Promise<ProviderSettings | null> {
    const data = await client.get<Wire>(`/accounts/${id}/provider`);
    if (!data) return null;
    const auth = data.auth ?? {};
    return {
      baseUrl: data.base_url ?? "",
      model: data.model ?? "",
      contextScope: data.context_scope ?? "",
      auth: {
        kind: auth.kind ?? "none",
        token: auth.token ?? "",
        user: auth.user ?? "",
        password: auth.password ?? "",
        headerName: auth.header_name ?? "",
        headerValue: auth.header_value ?? "",
      },
    };
  },

  async updateProvider(
    id: string,
    baseUrl: string,
    auth: ProviderAuth,
    contextScope: string,
  ): Promise<boolean> {
    const body = { base_url: baseUrl, auth: authWire(auth), context_scope: contextScope };
    const done = (await client.put(`/accounts/${id}/provider`, body)) !== null;
    if (done) serverDefaults.bump();
    return done;
  },

  async createProvider(
    label: string,
    baseUrl: string,
    auth: ProviderAuth,
    contextScope: string,
  ): Promise<Account | null> {
    const data = await client.post<Wire>("/accounts/provider", {
      label,
      base_url: baseUrl,
      auth: authWire(auth),
      context_scope: contextScope,
    });
    if (data) serverDefaults.bump();
    return data && parse(data);
  },

  async rename(id: string, label: string): Promise<boolean> {
    const done = (await client.put(`/accounts/${id}`, { label })) !== null;
    if (done) serverDefaults.bump();
    return done;
  },

  async remove(id: string): Promise<boolean> {
    const done = (await client.delete(`/accounts/${id}`)) !== null;
    if (done) serverDefaults.bump();
    return done;
  },

  async startLogin(id: string): Promise<string | null> {
    const data = await client.post<Wire>(`/accounts/${id}/login`);
    return data?.url ?? null;
  },

  async submitCode(id: string, code: string): Promise<boolean> {
    const done = (await client.post(`/accounts/${id}/login/code`, { code })) !== null;
    if (done) serverDefaults.bump();
    return done;
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
        if (response.ok) serverDefaults.bump();
        return response.ok;
      } catch {
        return false;
      }
    });
  },
});

export const accountsApi = createAccountsApi(http);
