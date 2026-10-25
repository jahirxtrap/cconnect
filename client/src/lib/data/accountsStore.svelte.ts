import { accountsApi, type Account, type AccountsSnapshot, type ProviderSettings } from "$lib/services/accountsApi";
import { backend } from "$lib/services/backend.svelte";

class AccountsStore {
  snapshot = $state<AccountsSnapshot | null>(null);
  providers = $state<Record<string, ProviderSettings>>({});

  readonly items = $derived<Account[]>(this.snapshot?.accounts ?? []);
  readonly defaultId = $derived(this.snapshot?.default ?? "");

  async load() {
    this.snapshot = backend.configured ? await accountsApi.list() : null;
  }

  async loadProviders() {
    const found = await Promise.all(
      this.items.filter((account) => account.provider).map(async (account) => [account.id, await accountsApi.provider(account.id)] as const),
    );
    this.providers = Object.fromEntries(found.filter((entry): entry is [string, ProviderSettings] => entry[1] !== null));
  }

  ensure() {
    if (this.snapshot === null) void this.load();
  }

  find(id: string) {
    return this.items.find((account) => account.id === id) ?? null;
  }
}

export const accountsStore = new AccountsStore();
