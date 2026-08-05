import { http, type HttpClient } from "./http";

export interface Account {
  id: string;
  label: string;
  loggedIn: boolean;
  primary: boolean;
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
});

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

  async rename(id: string, label: string): Promise<boolean> {
    return (await client.put(`/accounts/${id}`, { label })) !== null;
  },

  async remove(id: string): Promise<boolean> {
    return (await client.delete(`/accounts/${id}`)) !== null;
  },

  async syncMcp(id: string): Promise<boolean> {
    return (await client.post(`/accounts/${id}/mcp-sync`)) !== null;
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
});

export const accountsApi = createAccountsApi(http);
