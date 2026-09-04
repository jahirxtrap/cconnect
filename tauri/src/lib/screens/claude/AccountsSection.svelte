<script lang="ts">
  import CircleUser from "@lucide/svelte/icons/circle-user";
  import Component from "@lucide/svelte/icons/component";
  import { t } from "$lib/i18n/index.svelte";
  import { copyText } from "$lib/platform/clipboard";
  import { openExternal } from "$lib/platform";
  import { downloadShared } from "$lib/services/sharedFiles";
  import {
    accountsApi,
    emptyAuth,
    type Account,
    type AccountsSnapshot,
    type ProviderAuth,
    type ProviderAuthKind,
    type ProviderProbe,
  } from "$lib/services/accountsApi";
  import { settingsApi } from "$lib/services/settingsApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    enabled: boolean;
    onChanged: () => void;
  }

  const { enabled, onChanged }: Props = $props();

  const PROBE_PREVIEW = 8;

  const AUTH_OPTIONS = [
    { value: "none", label: t("AUTH_NONE") },
    { value: "bearer", label: t("AUTH_BEARER") },
    { value: "api_key", label: t("AUTH_API_KEY") },
    { value: "basic", label: t("AUTH_BASIC") },
    { value: "header", label: t("AUTH_HEADER") },
  ];

  let snapshot = $state<AccountsSnapshot | null>(null);
  let adding = $state(false);
  let actions = $state<Account | null>(null);
  let renaming = $state<Account | null>(null);
  let deleting = $state<Account | null>(null);
  let busy = $state<string | null>(null);
  let login = $state<{ id: string; url: string } | null>(null);
  let loginError = $state<string | null>(null);
  let code = $state("");
  let newLabel = $state("");
  let importing = $state(false);
  let importFailed = $state(false);
  let providerAdding = $state(false);
  let editing = $state<Account | null>(null);
  let providerUrl = $state("");
  let auth = $state<ProviderAuth>(emptyAuth());
  let probing = $state(false);
  let probe = $state<ProviderProbe | null>(null);
  let bundlePicker = $state<HTMLInputElement | null>(null);

  const importBundle = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    importing = true;
    const ok = await accountsApi.importBundle(file, newLabel.trim());
    importing = false;
    importFailed = !ok;
    if (!ok) return;
    adding = false;
    await refresh();
  };

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
    account.provider
      ? account.provider.baseUrl
      : !account.loggedIn
        ? t("ACCOUNT_PENDING")
        : account.id === defaultId
          ? t("ACCOUNT_IS_DEFAULT")
          : t("ACCOUNT_CONNECTED");

  const presetOptions = $derived([
    { value: "", label: t("ACCOUNT_PROVIDER_CUSTOM") },
    ...(snapshot?.presets ?? []).map((preset) => ({ value: preset.id, label: preset.label })),
  ]);
  const presetId = $derived(
    (snapshot?.presets ?? []).find((preset) => preset.baseUrl === providerUrl.trim().replace(/\/$/, ""))
      ?.id ?? "",
  );

  const pickPreset = (id: string) => {
    providerUrl = (snapshot?.presets ?? []).find((item) => item.id === id)?.baseUrl ?? "";
    probe = null;
  };

  const probeProvider = async (url: string) => {
    probing = true;
    probe = await accountsApi.detectProvider(url, auth);
    if (probe) providerUrl = probe.baseUrl;
    probing = false;
  };

  const openProvider = () => {
    adding = false;
    probe = null;
    editing = null;
    providerUrl = snapshot?.presets[0]?.baseUrl ?? snapshot?.providerUrl ?? "";
    auth = emptyAuth();
    newLabel = "";
    providerAdding = true;
  };

  const editProvider = (account: Account) => {
    probe = null;
    editing = account;
    providerUrl = "";
    newLabel = account.label;
    auth = emptyAuth();
    providerAdding = true;
    void accountsApi.provider(account.id).then((stored) => {
      if (!stored || editing !== account) return;
      providerUrl = stored.baseUrl;
      auth = stored.auth;
    });
  };

  const saveProvider = async () => {
    const target = editing;
    const label = newLabel.trim();
    providerAdding = false;
    if (target) {
      await accountsApi.updateProvider(target.id, providerUrl, auth);
      if (label && label !== target.label) await accountsApi.rename(target.id, label);
    } else {
      await accountsApi.createProvider(label || t("ACCOUNT_PROVIDER"), providerUrl, auth);
    }
    await refresh();
  };

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
      icon={account.provider ? Component : CircleUser}
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
    <ActionButton
      text={t("ACCOUNT_ADD")}
      {enabled}
      onclick={() => {
        importFailed = false;
        newLabel = "";
        adding = true;
      }}
      class="w-full"
    />
  </div>
</SettingsGroup>

{#if actions}
  {@const account = actions}
  <CompactDialog title={account.label} onDismiss={() => (actions = null)}>
    {#snippet buttons()}
      <Button onclick={() => (actions = null)} variant="outlined">{t("CANCEL")}</Button>
    {/snippet}
    <div class="flex flex-col gap-1.5">
      {#if account.provider}
        <ActionButton
          text={t("ACCOUNT_PROVIDER_EDIT")}
          onclick={() => {
            const target = account;
            actions = null;
            editProvider(target);
          }}
          class="w-full"
        />
      {:else}
        <ActionButton
          text={account.loggedIn ? t("ACCOUNT_RELOGIN") : t("ACCOUNT_LOGIN")}
          onclick={() => {
            const target = account;
            actions = null;
            void beginLogin(target);
          }}
          class="w-full"
        />
      {/if}
      {#if account.loggedIn && account.id !== defaultId}
        <ActionButton
          text={t("ACCOUNT_SET_DEFAULT")}
          onclick={() => {
            const target = account;
            actions = null;
            void settingsApi.update({ account: target.id }).then(refresh);
          }}
          class="w-full"
        />
      {/if}
      <ActionButton
        text={t("RENAME")}
        onclick={() => {
          const target = account;
          actions = null;
          renaming = target;
        }}
        class="w-full"
      />
      {#if account.loggedIn}
        <ActionButton
          text={t("ACCOUNT_EXPORT")}
          onclick={() => {
            const target = account;
            actions = null;
            void downloadShared(accountsApi.exportUrl(target.id), `${target.id}.zip`);
          }}
          class="w-full"
        />
      {/if}
      {#if !account.primary}
        <ActionButton
          text={t("DELETE")}
          onclick={() => {
            const target = account;
            actions = null;
            deleting = target;
          }}
          class="w-full"
        />
      {/if}
    </div>
  </CompactDialog>
{/if}

{#if adding}
  <CompactDialog title={t("ACCOUNT_ADD")} onDismiss={() => (adding = false)}>
    {#snippet buttons()}
      <Button onclick={() => (adding = false)} variant="outlined">{t("CANCEL")}</Button>
      <Button
        enabled={!!newLabel.trim() && !importing}
        onclick={() => {
          const label = newLabel;
          adding = false;
          void accountsApi.create(label).then(refresh);
        }}>{t("ACCOUNT_ADD")}</Button
      >
    {/snippet}
    <InputField
      value={newLabel}
      oninput={(value) => (newLabel = value)}
      label={t("ACCOUNT_NAME")}
      singleLine
    />
    <ActionButton
      text={t("ACCOUNT_IMPORT")}
      enabled={!importing}
      onclick={() => bundlePicker?.click()}
      class="mt-3 w-full"
    />
    <ActionButton
      text={t("ACCOUNT_PROVIDER")}
      enabled={!importing}
      onclick={openProvider}
      class="mt-1.5 w-full"
    />
    {#if importing}
      <LoadingIndicator size={20} class="mt-3" />
    {/if}
    {#if importFailed}
      <p class="mt-2 text-body-sm text-red">{t("ACCOUNT_IMPORT_FAILED")}</p>
    {/if}
  </CompactDialog>
  <input
    bind:this={bundlePicker}
    type="file"
    accept=".zip"
    onchange={importBundle}
    class="hidden"
  />
{/if}

{#if providerAdding}
  <CompactDialog
    title={editing ? t("ACCOUNT_PROVIDER_EDIT") : t("ACCOUNT_PROVIDER")}
    onDismiss={() => (providerAdding = false)}
  >
    {#snippet buttons()}
      <Button onclick={() => (providerAdding = false)} variant="outlined">{t("CANCEL")}</Button>
      <Button enabled={providerUrl.trim() !== "" && !probing} onclick={() => void saveProvider()}>
        {editing ? t("SAVE") : t("ACCOUNT_ADD")}
      </Button>
    {/snippet}
    <InputField
      value={newLabel}
      oninput={(value) => (newLabel = value)}
      label={t("ACCOUNT_NAME")}
      singleLine
    />
    <div class="mt-3">
      <SelectField
        label={t("ACCOUNT_PROVIDER_PRESET")}
        selected={presetId}
        options={presetOptions}
        onSelect={pickPreset}
      />
    </div>
    <div class="mt-3">
      <InputField
        value={providerUrl}
        oninput={(value) => (providerUrl = value)}
        label={t("ACCOUNT_PROVIDER_URL")}
        singleLine
      />
    </div>
    <div class="mt-3">
      <SelectField
        label={t("ENVIRONMENT_AUTH")}
        selected={auth.kind}
        options={AUTH_OPTIONS}
        onSelect={(value) => (auth.kind = value as ProviderAuthKind)}
      />
    </div>
    {#if auth.kind === "bearer" || auth.kind === "api_key"}
      <div class="mt-3">
        <InputField
          value={auth.token}
          oninput={(value) => (auth.token = value)}
          label={auth.kind === "api_key" ? t("AUTH_API_KEY") : t("ENVIRONMENT_TOKEN")}
          secret
          singleLine
        />
      </div>
    {:else if auth.kind === "basic"}
      <div class="mt-3">
        <InputField
          value={auth.user}
          oninput={(value) => (auth.user = value)}
          label={t("AUTH_USER")}
          singleLine
        />
      </div>
      <div class="mt-3">
        <InputField
          value={auth.password}
          oninput={(value) => (auth.password = value)}
          label={t("AUTH_PASSWORD")}
          secret
          singleLine
        />
      </div>
    {:else if auth.kind === "header"}
      <div class="mt-3">
        <InputField
          value={auth.headerName}
          oninput={(value) => (auth.headerName = value)}
          label={t("AUTH_HEADER_NAME")}
          singleLine
        />
      </div>
      <div class="mt-3">
        <InputField
          value={auth.headerValue}
          oninput={(value) => (auth.headerValue = value)}
          label={t("AUTH_HEADER_VALUE")}
          secret
          singleLine
        />
      </div>
    {/if}
    {#if probe?.found}
      <OutlinedPanel class="mt-3">
        <p class="text-body-sm text-on-surface-variant">
          {t("ACCOUNT_PROVIDER_FOUND", `${probe.models.length}`)}
        </p>
        <div class="mt-1.5 flex flex-col gap-1">
          {#each probe.models.slice(0, PROBE_PREVIEW) as model (model)}
            <p class="truncate text-body-sm">{model}</p>
          {/each}
          {#if probe.models.length > PROBE_PREVIEW}
            <p class="text-body-sm text-on-surface-variant">
              {t("ACCOUNT_PROVIDER_MORE", `${probe.models.length - PROBE_PREVIEW}`)}
            </p>
          {/if}
        </div>
      </OutlinedPanel>
    {:else if probe && !probing}
      <p class="mt-3 text-body-sm text-red">{t("ACCOUNT_PROVIDER_MISSING")}</p>
    {/if}
    <div class="mt-3 flex flex-col gap-2.5">
      {#if probing}
        <LinearProgress />
      {/if}
      <ActionButton
        text={t("ACCOUNT_PROVIDER_PROBE")}
        enabled={!probing && !!providerUrl.trim()}
        onclick={() => void probeProvider(providerUrl)}
        class="w-full"
      />
    </div>
  </CompactDialog>
{/if}

{#if renaming}
  {@const account = renaming}
  <RenameDialog
    initial={account.label}
    title={t("ACCOUNT_NAME")}
    onConfirm={(label) => {
      const target = account;
      renaming = null;
      void accountsApi.rename(target.id, label).then(refresh);
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
      const target = account;
      deleting = null;
      void accountsApi.remove(target.id).then(refresh);
    }}
    onDismiss={() => (deleting = null)}
  />
{/if}

{#if login}
  {@const current = login}
  {@const loginLabel = accounts.find((item) => item.id === current.id)?.loggedIn
    ? t("ACCOUNT_RELOGIN")
    : t("ACCOUNT_LOGIN")}
  <CompactDialog title={loginLabel} onDismiss={cancelLogin}>
    {#snippet buttons()}
      <Button onclick={cancelLogin} variant="outlined">{t("CANCEL")}</Button>
      <Button onclick={() => void submitCode()} enabled={!!code.trim()}>
        {loginLabel}
      </Button>
    {/snippet}
    <p class="text-body-md">{t("ACCOUNT_LOGIN_HINT")}</p>
    <p class="mt-3 line-clamp-3 wrap-anywhere text-body-sm text-accent">{current.url}</p>
    <div class="mt-2 flex flex-col gap-1.5">
      <ActionButton
        text={t("ACCOUNT_COPY_LINK")}
        onclick={() => void copyText(current.url)}
        class="w-full"
      />
      <ActionButton
        text={t("OPEN")}
        onclick={() => openExternal(current.url)}
        class="w-full"
      />
    </div>
    <div class="mt-3">
      <InputField value={code} oninput={(value) => (code = value)} label={t("ACCOUNT_CODE")} singleLine />
    </div>
  </CompactDialog>
{/if}
