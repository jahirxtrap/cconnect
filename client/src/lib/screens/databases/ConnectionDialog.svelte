<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import { untrack } from "svelte";
  import {
    databaseFailureText,
    engineLabel,
    type DatabaseConnection,
    type DatabaseFailure,
    type SshTunnel,
  } from "$lib/data/databaseModels";
  import { joined, masked, pairsOf, pairsText } from "$lib/data/format";
  import { keyRefused, type KeyGate } from "$lib/data/keyGate.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { databases } from "$lib/services/databases.svelte";
  import { createDatabasesApi, type ConnectionFields } from "$lib/services/databasesApi";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import { FIELD_PORT_CLASS, FIELD_ROW_CLASS, FIELD_WIDE_CLASS } from "$lib/ui/field";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import SwitchRow from "$lib/ui/SwitchRow.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    connection: DatabaseConnection | null;
    gate: KeyGate;
    onDismiss: () => void;
  }

  const { connection, gate, onDismiss }: Props = $props();

  const SSH_PORT = 22;
  const DRIVER = "driver";
  const URL_PLACEHOLDER = "dialect+driver://user@host:port/database";

  type Picking = "path" | "key" | null;

  const api = createDatabasesApi(() => backend.active);
  const start = untrack(() => connection);
  const portText = (port: number | null | undefined) => (port ? String(port) : "");

  const profile = $derived(backend.active);
  const engines = $derived(
    (databases.listOf(profile)?.engines ?? []).filter(
      (item) => item.installed || item.form === "url" || item.id === start?.engine,
    ),
  );

  let engine = $state(start?.engine ?? untrack(() => engines[0]?.id ?? ""));
  let name = $state(start?.name ?? "");
  let path = $state(start?.path ?? "");
  let address = $state(start?.url ?? "");
  let packages = $state(start?.packages.join(" ") ?? "");
  let host = $state(start?.host ?? "");
  let port = $state(portText(start?.port));
  let database = $state(start?.database ?? "");
  let user = $state(start?.user ?? "");
  let password = $state<string | null>(start?.hasPassword ? null : "");
  let options = $state(pairsText(start?.options ?? {}));
  let readOnly = $state(start?.readOnly ?? false);
  let tunnel = $state(start?.ssh !== null && start?.ssh !== undefined);
  let sshHost = $state(start?.ssh?.host ?? "");
  let sshPort = $state(portText(start?.ssh?.port));
  let sshUser = $state(start?.ssh?.user ?? "");
  let sshKey = $state(start?.ssh?.key ?? "");
  let picking = $state<Picking>(null);
  let busy = $state(false);
  let failed = $state<string | null>(null);
  let missingDriver = $state(false);
  let tested = $state<string | null>(null);

  const selected = $derived(engines.find((item) => item.id === engine) ?? null);
  const form = $derived(selected?.form ?? "server");
  const wanted = $derived(packages.replace(/,/g, " ").split(/\s+/).filter(Boolean));
  const needsDriver = $derived(form === "url" ? missingDriver && wanted.length > 0 : !!selected && !selected.installed);
  const located = $derived(form === "file" ? !!path.trim() : form === "url" ? !!address.trim() : !selected?.host || !!host.trim());
  const valid = $derived(!!selected && !!name.trim() && located && (!tunnel || !!sshHost.trim()));
  const engineOptions = $derived(engines.map((item) => ({ value: item.id, label: engineLabel(item, item.id) })));
  const optionHint = $derived(selected?.options.map((key) => `${key}=`).join("\n") || t("AGENT_ENV_PLACEHOLDER"));

  const digits = (value: string) => value.replace(/\D/g, "");
  const numberOf = (value: string) => (value ? Number.parseInt(value, 10) : null);

  const ssh = (): SshTunnel | null =>
    tunnel ? { host: sshHost.trim(), port: numberOf(sshPort), user: sshUser.trim(), key: sshKey.trim() } : null;

  const secret = () => (password === null ? {} : { password });

  const fields = (): ConnectionFields => {
    const shared = { name: name.trim(), engine, read_only: readOnly };
    if (form === "file") return { ...shared, path: path.trim() };
    if (form === "url") return { ...shared, url: address.trim(), packages: wanted, ssh: ssh(), ...secret() };
    return {
      ...shared,
      host: host.trim(),
      port: numberOf(port),
      database: database.trim(),
      user: user.trim(),
      options: pairsOf(options),
      ssh: ssh(),
      ...secret(),
    };
  };

  const settle = (failure: DatabaseFailure | null) => {
    missingDriver = failure?.reason === DRIVER;
    failed = databaseFailureText(failure);
  };

  const begin = () => {
    busy = true;
    failed = null;
    tested = null;
  };

  const install = async () => {
    begin();
    const result = await gate.run((key) => (form === "url" ? api.installPackages(wanted, key) : api.install(engine, key)));
    busy = false;
    if (result.ok) {
      missingDriver = false;
      databases.adoptEngines(profile, result.value);
    } else if (!keyRefused(result)) settle(result.failure);
  };

  const test = async () => {
    begin();
    const result = await gate.run((key) => api.test(fields(), start?.id ?? null, key));
    busy = false;
    if (result.ok) tested = joined(t("DATABASE_TEST_OK"), result.value && t("VERSION_LABEL", result.value));
    else if (!keyRefused(result)) settle(result.failure);
  };

  const save = async () => {
    begin();
    const result = await gate.run((key) => (start ? api.update(start.id, fields(), key) : api.add(fields(), key)));
    busy = false;
    if (!result.ok) {
      if (!keyRefused(result)) settle(result.failure);
      return;
    }
    if (start) databases.forget(profile, start.id);
    await databases.refresh(profile);
    onDismiss();
  };
</script>

{#snippet browse(target: "path" | "key")}
  <TooltipIconButton label={t("BROWSE")} onclick={() => (picking = target)}>
    <Folder />
  </TooltipIconButton>
{/snippet}

{#snippet pathBrowse()}
  {@render browse("path")}
{/snippet}

{#snippet keyBrowse()}
  {@render browse("key")}
{/snippet}

<CompactDialog title={start ? t("DATABASE_EDIT_CONNECTION") : t("DATABASE_ADD_CONNECTION")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button enabled={valid && !busy} onclick={() => void save()}>{start ? t("SAVE") : t("ADD")}</Button>
  {/snippet}
  <InputField value={name} oninput={(value) => (name = value)} label={t("NAME")} singleLine autofocus={!start} />
  <div class="mt-3">
    <SelectField
      label={t("DATABASE_ENGINE")}
      selected={engine}
      options={engineOptions}
      onSelect={(value) => {
        engine = value;
        tested = null;
        failed = null;
        missingDriver = false;
      }}
    />
    {#if needsDriver && selected}
      <p class="mt-1.5 text-body-sm text-on-surface-variant">
        {t("DATABASE_REASON_DRIVER")}
      </p>
    {/if}
  </div>
  {#if form === "file"}
    <div class="mt-3">
      <InputField
        value={path}
        oninput={(value) => (path = value)}
        label={t("DATABASE_FILE")}
        placeholder={t("DATABASE_FILE_PLACEHOLDER")}
        singleLine
        url
        trailing={pathBrowse}
      />
    </div>
  {:else if form === "url"}
    <div class="mt-3">
      <InputField
        value={address}
        oninput={(value) => (address = value)}
        label={t("URL")}
        placeholder={URL_PLACEHOLDER}
        singleLine
        url
        mono
      />
      <p class="mt-1.5 text-body-sm text-on-surface-variant">{t("DATABASE_URL_HINT")}</p>
    </div>
    <div class="mt-3">
      <InputField
        value={packages}
        oninput={(value) => (packages = value)}
        label={t("DATABASE_PACKAGES")}
        optional
        singleLine
        url
        mono
      />
      <p class="mt-1.5 text-body-sm text-on-surface-variant">{t("DATABASE_PACKAGES_HINT")}</p>
    </div>
  {:else}
    <div class="mt-3 {FIELD_ROW_CLASS}">
      <InputField
        value={host}
        oninput={(value) => (host = value)}
        label={t("HOST")}
        optional={!selected?.host}
        singleLine
        url
        class={FIELD_WIDE_CLASS}
      />
      <InputField
        value={port}
        oninput={(value) => (port = digits(value))}
        label={t("PORT")}
        placeholder={portText(selected?.port)}
        optional
        singleLine
        numeric
        class={FIELD_PORT_CLASS}
      />
    </div>
    <div class="mt-3">
      <InputField value={database} oninput={(value) => (database = value)} label={t("DATABASE_NAME")} optional singleLine url />
    </div>
    <div class="mt-3">
      <InputField value={user} oninput={(value) => (user = value)} label={t("SSH_USER")} optional singleLine url />
    </div>
  {/if}
  {#if form !== "file"}
    <div class="mt-3">
      <InputField
        value={password ?? ""}
        oninput={(value) => (password = value)}
        label={t("SSH_PASSWORD")}
        placeholder={password === null ? masked() : undefined}
        optional
        singleLine
        secret
      />
    </div>
  {/if}
  {#if form === "server"}
    <div class="mt-3">
      <InputField
        value={options}
        oninput={(value) => (options = value)}
        label={t("DATABASE_OPTIONS")}
        placeholder={optionHint}
        optional
        minLines={2}
        mono
      />
    </div>
  {/if}
  {#if form !== "file"}
    <div class="mt-3">
      <SwitchRow
        title={t("DATABASE_SSH_TUNNEL")}
        summary={t("DATABASE_SSH_TUNNEL_SUMMARY")}
        checked={tunnel}
        onChange={(value) => (tunnel = value)}
      />
    </div>
    {#if tunnel}
      <div class="mt-3 {FIELD_ROW_CLASS}">
        <InputField
          value={sshHost}
          oninput={(value) => (sshHost = value)}
          label={t("DATABASE_SSH_HOST")}
          singleLine
          url
          class={FIELD_WIDE_CLASS}
        />
        <InputField
          value={sshPort}
          oninput={(value) => (sshPort = digits(value))}
          label={t("DATABASE_SSH_PORT")}
          placeholder={String(SSH_PORT)}
          optional
          singleLine
          numeric
          class={FIELD_PORT_CLASS}
        />
      </div>
      <div class="mt-3">
        <InputField value={sshUser} oninput={(value) => (sshUser = value)} label={t("DATABASE_SSH_USER")} optional singleLine url />
      </div>
      <div class="mt-3">
        <InputField
          value={sshKey}
          oninput={(value) => (sshKey = value)}
          label={t("DATABASE_SSH_KEY")}
          optional
          singleLine
          url
          trailing={keyBrowse}
        />
      </div>
    {/if}
  {/if}
  <div class="mt-3">
    <SwitchRow
      title={t("DATABASE_READ_ONLY")}
      summary={t("DATABASE_READ_ONLY_SUMMARY")}
      checked={readOnly}
      onChange={(value) => (readOnly = value)}
    />
  </div>
  {#if tested}
    <CardPanel class="mt-3">
      <p class="text-body-sm text-on-surface-variant">{tested}</p>
    </CardPanel>
  {:else if failed}
    <ErrorText text={failed} class="mt-3" />
  {/if}
  <div class="mt-3 mb-2 flex flex-col gap-2.5">
    {#if busy}
      <LinearProgress />
    {/if}
    <ActionButton
      text={needsDriver ? t("DATABASE_INSTALL_DRIVER") : t("DATABASE_TEST")}
      enabled={!busy && (needsDriver || valid)}
      onclick={() => void (needsDriver ? install() : test())}
      class="w-full"
    />
  </div>
</CompactDialog>

{#if picking}
  {@const target = picking}
  <PathPickerDialog
    mode="file"
    start={target === "path" ? path : sshKey}
    onConfirm={(picked) => {
      if (target === "path") path = picked;
      else sshKey = picked;
      picking = null;
    }}
    onDismiss={() => (picking = null)}
  />
{/if}
