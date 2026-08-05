<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import { t } from "$lib/i18n/index.svelte";
  import { accountsApi, type Account, type AccountsSnapshot } from "$lib/services/accountsApi";
  import { settingsApi } from "$lib/services/settingsApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    enabled: boolean;
    onChanged: () => void;
  }

  const { enabled, onChanged }: Props = $props();

  let snapshot = $state<AccountsSnapshot | null>(null);
  let adding = $state(false);
  let actions = $state<Account | null>(null);
  let renaming = $state<Account | null>(null);
  let deleting = $state<Account | null>(null);
  let busy = $state<string | null>(null);
  let login = $state<{ id: string; url: string } | null>(null);
  let loginError = $state<string | null>(null);
  let code = $state("");

  const accounts = $derived(snapshot?.accounts ?? []);
  const defaultId = $derived(snapshot?.default ?? "");

  const reload = async () => {
    if (enabled) snapshot = await accountsApi.list();
  };

  const refresh = async () => {
    await reload();
    onChanged();
  };

  const beginLogin = async (account: Account) => {
    busy = account.id;
    loginError = null;
    const url = await accountsApi.startLogin(account.id);
    busy = null;
    if (url) {
      code = "";
      login = { id: account.id, url };
    } else {
      loginError = account.id;
    }
  };

  const summaryOf = (account: Account) =>
    !account.loggedIn ? t("ACCOUNT_PENDING") : account.id === defaultId ? t("ACCOUNT_IS_DEFAULT") : t("ACCOUNT_CONNECTED");

  const cancelLogin = () => {
    const current = login;
    login = null;
    if (current) void accountsApi.cancelLogin(current.id);
  };

  const submitCode = async () => {
    const current = login;
    if (!current) return;
    const entered = code;
    login = null;
    busy = current.id;
    const ok = await accountsApi.submitCode(current.id, entered);
    busy = null;
    loginError = ok ? null : current.id;
    await refresh();
  };

  $effect(() => {
    void enabled;
    void reload();
  });
</script>

<SettingsGroup label={t("ACCOUNTS")}>
  {#each accounts as account (account.id)}
    <PreferenceRow
      icon={CircleUser}
      title={account.label}
      summary={summaryOf(account)}
      alert={loginError === account.id ? t("ACCOUNT_LOGIN_FAILED") : null}
      {enabled}
      onclick={enabled ? () => (actions = account) : undefined}
    >
      {#snippet trailing()}
        {#if busy === account.id}
          <LoadingIndicator size={20} />
        {:else}
          <StatusDot class={account.loggedIn ? "bg-green" : "bg-orange"} box={20} dot={12} />
        {/if}
      {/snippet}
    </PreferenceRow>
  {/each}
  <div class="px-4 py-3">
    <ActionButton text={t("ACCOUNT_ADD")} {enabled} onclick={() => (adding = true)} class="w-full" />
  </div>
</SettingsGroup>

{#if actions}
  {@const account = actions}
  <CompactDialog title={account.label} onDismiss={() => (actions = null)}>
    {#snippet buttons()}
      <Button onclick={() => (actions = null)} variant="outlined">{t("CLOSE")}</Button>
    {/snippet}
    <div class="flex flex-col gap-1.5">
      {#if !account.loggedIn}
        <ActionButton
          text={t("ACCOUNT_LOGIN")}
          onclick={() => {
            actions = null;
            void beginLogin(account);
          }}
          class="w-full"
        />
      {/if}
      {#if account.loggedIn && account.id !== defaultId}
        <ActionButton
          text={t("ACCOUNT_SET_DEFAULT")}
          onclick={() => {
            actions = null;
            void settingsApi.update({ account: account.id }).then(refresh);
          }}
          class="w-full"
        />
      {/if}
      <ActionButton
        text={t("RENAME")}
        onclick={() => {
          actions = null;
          renaming = account;
        }}
        class="w-full"
      />
      {#if !account.primary}
        <ActionButton
          text={t("ACCOUNT_SYNC_MCP")}
          onclick={() => {
            actions = null;
            void accountsApi.syncMcp(account.id);
          }}
          class="w-full"
        />
        <ActionButton
          text={t("DELETE")}
          onclick={() => {
            actions = null;
            deleting = account;
          }}
          class="w-full"
        />
      {/if}
    </div>
  </CompactDialog>
{/if}

{#if adding}
  <RenameDialog
    initial=""
    title={t("ACCOUNT_ADD")}
    confirmLabel={t("ACCOUNT_ADD")}
    onConfirm={(label) => {
      adding = false;
      void accountsApi.create(label).then(refresh);
    }}
    onDismiss={() => (adding = false)}
  />
{/if}

{#if renaming}
  {@const account = renaming}
  <RenameDialog
    initial={account.label}
    title={t("ACCOUNT_NAME")}
    onConfirm={(label) => {
      renaming = null;
      void accountsApi.rename(account.id, label).then(refresh);
    }}
    onDismiss={() => (renaming = null)}
  />
{/if}

{#if deleting}
  {@const account = deleting}
  <ConfirmDialog
    title={account.label}
    text={t("DELETE")}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      deleting = null;
      void accountsApi.remove(account.id).then(refresh);
    }}
    onDismiss={() => (deleting = null)}
  />
{/if}

{#if login}
  {@const current = login}
  <CompactDialog title={t("ACCOUNT_LOGIN")} onDismiss={cancelLogin}>
    {#snippet buttons()}
      <Button onclick={cancelLogin} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void submitCode()} enabled={!!code.trim()}>
        {t("ACCOUNT_LOGIN")}
      </Button>
    {/snippet}
    <p class="text-body-md">{t("ACCOUNT_LOGIN_HINT")}</p>
    <p class="mt-3 line-clamp-3 wrap-anywhere text-body-sm text-accent">{current.url}</p>
    <div class="mt-2 flex flex-col gap-1.5">
      <ActionButton
        text={t("ACCOUNT_COPY_LINK")}
        onclick={() => void navigator.clipboard.writeText(current.url)}
        class="w-full"
      />
      <ActionButton
        text={t("OPEN")}
        onclick={() => window.open(current.url, "_blank", "noopener")}
        class="w-full"
      />
    </div>
    <div class="mt-3">
      <InputField value={code} oninput={(value) => (code = value)} label={t("ACCOUNT_CODE")} singleLine />
    </div>
  </CompactDialog>
{/if}
