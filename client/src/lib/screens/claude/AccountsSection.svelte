<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { downloadShared } from "$lib/services/sharedFiles";
  import { accountsStore } from "$lib/data/accountsStore.svelte";
  import { AUTH_KINDS, emptyAuth, type AuthInput } from "$lib/data/auth";
  import { formatDay, MILLIS_PER_DAY, parseIsoMillis } from "$lib/data/time";
  import { accountIdOf } from "$lib/screens/settings/settingsIndex";
  import { useSettingsDialog } from "$lib/screens/settings/useSettingsDialog.svelte";
  import { accountSummary, scopeLabel } from "$lib/screens/settings/settingsValues";
  import { accountsApi, type Account, type ProviderProbe } from "$lib/services/accountsApi";
  import { settingsApi } from "$lib/services/settingsApi";
  import { accountIcon } from "$lib/ui/accountIcon";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import AuthFields from "$lib/ui/AuthFields.svelte";
  import Button from "$lib/ui/Button.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import SignInDialog from "./SignInDialog.svelte";

  interface Props {
    enabled: boolean;
    onChanged: () => void;
  }

  const { enabled, onChanged }: Props = $props();

  const PROBE_PREVIEW = 8;

  let adding = $state(false);
  let actions = $state<Account | null>(null);
  let renaming = $state<Account | null>(null);
  let deleting = $state<Account | null>(null);
  let busy = $state<string | null>(null);
  let login = $state<{ id: string; url: string } | null>(null);
  let loginError = $state<string | null>(null);
  let newLabel = $state("");
  let importing = $state(false);
  let importFailed = $state(false);
  let providerAdding = $state(false);
  let editing = $state<Account | null>(null);
  let providerUrl = $state("");
  let auth = $state<AuthInput>(emptyAuth());
  let offered = $state(false);
  let purpose = $state("");

  const LOGIN_WARNING_DAYS = 10;

  let loginEnds = $state<number | null>(null);
  const loginEndsSoon = $derived(loginEnds !== null && loginEnds - Date.now() <= LOGIN_WARNING_DAYS * MILLIS_PER_DAY);

  const openActions = (account: Account) => {
    offered = account.delegate;
    purpose = account.purpose;
    loginEnds = null;
    actions = account;
    if (account.provider || !account.loggedIn) return;
    void accountsApi.loginExpiry(account.id).then((value) => {
      if (actions?.id === account.id) loginEnds = value === null ? null : parseIsoMillis(value);
    });
  };

  const saveDelegation = async (account: Account) => {
    actions = null;
    await accountsApi.setDelegation(account.id, offered, purpose.trim());
    await refresh();
  };

  let contextScope = $state("");
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

  const accounts = $derived(accountsStore.items);
  const defaultId = $derived(accountsStore.defaultId);

  const reload = async () => {
    if (!enabled) return;
    await accountsStore.load();
    await accountsStore.loadProviders();
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
      login = { id: account.id, url };
    } else {
      loginError = account.id;
    }
  };

  const presets = $derived(accountsStore.snapshot?.presets ?? []);
  const scopes = $derived(accountsStore.snapshot?.scopes ?? []);
  const scopeOptions = $derived(scopes.map((id) => ({ value: id, label: scopeLabel(id) })));

  const presetOptions = $derived([
    { value: "", label: t("ACCOUNT_PROVIDER_CUSTOM") },
    ...presets.map((preset) => ({ value: preset.id, label: preset.label })),
  ]);
  const presetFor = (url: string) =>
    presets.find((preset) => preset.baseUrl === url.trim().replace(/\/$/, "")) ?? null;
  const presetId = $derived(presetFor(providerUrl)?.id ?? "");
  const suggestedScope = $derived(
    presetFor(providerUrl)?.defaultScope || accountsStore.snapshot?.scopeDefault || scopes[0] || "",
  );
  const scopeId = $derived(scopes.includes(contextScope) ? contextScope : suggestedScope);

  const pickPreset = (id: string) => {
    providerUrl = presets.find((item) => item.id === id)?.baseUrl ?? "";
    contextScope = "";
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
    providerUrl = presets[0]?.baseUrl ?? accountsStore.snapshot?.providerUrl ?? "";
    auth = emptyAuth();
    contextScope = "";
    newLabel = "";
    providerAdding = true;
  };

  const editProvider = (account: Account) => {
    const stored = accountsStore.providers[account.id];
    if (!stored) return;
    probe = null;
    editing = account;
    providerUrl = stored.baseUrl;
    newLabel = account.label;
    auth = stored.auth;
    contextScope = stored.contextScope;
    providerAdding = true;
  };

  const saveProvider = async () => {
    const target = editing;
    const label = newLabel.trim();
    const scope = scopeId;
    providerAdding = false;
    if (target) {
      await accountsApi.updateProvider(target.id, providerUrl, auth, scope);
      if (label && label !== target.label) await accountsApi.rename(target.id, label);
    } else {
      await accountsApi.createProvider(label || t("ACCOUNT_PROVIDER"), providerUrl, auth, scope);
    }
    await refresh();
  };

  const cancelLogin = () => {
    const current = login;
    login = null;
    if (current) void accountsApi.cancelLogin(current.id);
  };

  const submitCode = async (code: string) => {
    const current = login;
    if (!current) return;
    login = null;
    busy = current.id;
    const ok = await accountsApi.submitCode(current.id, code);
    busy = null;
    loginError = ok ? null : current.id;
    await refresh();
  };

  useSettingsDialog("claude", (dialog, entry) => {
    if (dialog !== "account_actions") return;
    const found = accountsStore.find(accountIdOf(entry.id));
    if (found) openActions(found);
  });

  $effect(() => {
    void enabled;
    void reload();
  });
</script>

<SettingsGroup label={t("ACCOUNTS")}>
  {#each accounts as account (account.id)}
    <PreferenceRow
      icon={accountIcon(!!account.provider)}
      title={account.label}
      summary={accountSummary(account)}
      alert={loginError === account.id ? t("ACCOUNT_LOGIN_FAILED") : null}
      {enabled}
      onclick={enabled ? () => openActions(account) : undefined}
    >
      {#snippet trailing()}
        <StatusDot class={account.loggedIn ? "bg-green" : "bg-orange"} box={20} loading={busy === account.id} />
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
      <Button
        enabled={offered !== account.delegate || purpose.trim() !== account.purpose}
        onclick={() => void saveDelegation(account)}>{t("SAVE")}</Button
      >
    {/snippet}
    <div class="flex flex-col gap-2">
      <SwitchRow
        title={t("ACCOUNT_DELEGATE")}
        summary={t("ACCOUNT_DELEGATE_SUMMARY")}
        checked={offered}
        onChange={(value) => (offered = value)}
      />
      {#if offered}
        <InputField value={purpose} oninput={(value) => (purpose = value)} label={t("PURPOSE")} optional minLines={2} />
      {/if}
      {#if loginEnds !== null}
        {#if loginEndsSoon}
          <ErrorText text={t("ACCOUNT_LOGIN_ENDS", formatDay(loginEnds))} />
        {:else}
          <p class="text-body-sm text-on-surface-variant">{t("ACCOUNT_LOGIN_ENDS", formatDay(loginEnds))}</p>
        {/if}
      {/if}
    </div>
    <div class="mt-3 flex flex-col gap-1.5">
      {#if account.provider}
        <ActionButton
          text={t("ACCOUNT_PROVIDER_EDIT")}
          enabled={!!accountsStore.providers[account.id]}
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
          danger
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
    {#if importFailed}
      <ErrorText text={t("ACCOUNT_IMPORT_FAILED")} class="mt-2" />
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
    <div class="mt-3 flex flex-col gap-3">
      <AuthFields value={auth} kinds={AUTH_KINDS} onChange={(next) => (auth = next)} />
    </div>
    {#if scopeOptions.length > 1}
      <div class="mt-3">
        <SelectField
          label={t("ACCOUNT_CONTEXT")}
          selected={scopeId}
          options={scopeOptions}
          onSelect={(value) => (contextScope = value)}
        />
        <p class="mt-1.5 text-body-sm text-on-surface-variant">
          {t(`ACCOUNT_CONTEXT_${scopeId.toUpperCase()}_HINT`)}
        </p>
      </div>
    {/if}
    {#if probe?.found}
      <CardPanel class="mt-3">
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
      </CardPanel>
    {:else if probe && !probing}
      <ErrorText text={t("ACCOUNT_PROVIDER_MISSING")} class="mt-3" />
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
    danger
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
  <SignInDialog
    title={loginLabel}
    confirmLabel={loginLabel}
    hint={t("ACCOUNT_LOGIN_HINT")}
    url={current.url}
    field={t("ACCOUNT_CODE")}
    onSubmit={(code) => void submitCode(code)}
    onDismiss={cancelLogin}
  />
{/if}
