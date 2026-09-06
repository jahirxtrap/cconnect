import { accountsApi, type Account, type AccountsSnapshot } from "$lib/services/accountsApi";
import { backend } from "$lib/services/backend.svelte";

class AccountsStore {
  snapshot = $state<AccountsSnapshot | null>(null);

  readonly items = $derived<Account[]>(this.snapshot?.accounts ?? []);
  readonly defaultId = $derived(this.snapshot?.default ?? "");

  async load() {
    this.snapshot = backend.configured ? await accountsApi.list() : null;
  }

  ensure() {
    if (this.snapshot === null) void this.load();
  }

  find(id: string) {
    return this.items.find((account) => account.id === id) ?? null;
  }
}

export const accountsStore = new AccountsStore();
