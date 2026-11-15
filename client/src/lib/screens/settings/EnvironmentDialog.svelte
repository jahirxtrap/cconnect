<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import Lock from "@lucide/svelte/icons/lock";
  import LockOpen from "@lucide/svelte/icons/lock-open";
  import ScanQrCode from "@lucide/svelte/icons/scan-qr-code";
  import { untrack } from "svelte";
  import { AUTH_KINDS, type AuthInput } from "$lib/data/auth";
  import { projectKeyOf } from "$lib/data/models";
  import { parseEnvironmentQr } from "$lib/data/qrPayload";
  import { settings } from "$lib/data/settings.svelte";
  import { theme } from "$lib/design/theme.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import {
    addressFields,
    authFields,
    authOf,
    DEFAULT_PORT,
    HTTPS_PORT,
    parseHostInput,
    type EnvironmentProfile,
  } from "$lib/services/backend.svelte";
  import { qrScanAvailable, scanQr } from "$lib/services/qrScanner.svelte";
  import AuthFields from "$lib/ui/AuthFields.svelte";
  import Button from "$lib/ui/Button.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import { accentLabel } from "./settingsValues";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { FIELD_PORT_CLASS, FIELD_ROW_CLASS, FIELD_WIDE_CLASS } from "$lib/ui/field";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    profile: EnvironmentProfile;
    isNew: boolean;
    isActive: boolean;
    onSave: (profile: EnvironmentProfile) => void;
    onDismiss: () => void;
  }

  const { profile, isNew, isActive, onSave, onDismiss }: Props = $props();

  const KIND_OPTIONS = isTauri
    ? [
        { value: "http", label: "HTTP" },
        { value: "https", label: "HTTPS" },
      ]
    : [{ value: "https", label: "HTTPS" }];

  const ENVIRONMENT_AUTH_KINDS = AUTH_KINDS.filter((kind) => kind !== "api_key");

  const defaultPortFor = (kind: string) => String(kind === "https" ? HTTPS_PORT : DEFAULT_PORT);

  const initial = untrack(() => profile);

  let name = $state(initial.name);
  let kind = $state<EnvironmentProfile["kind"]>(initial.kind);
  let host = $state(initial.host);
  let port = $state(initial.port === null ? defaultPortFor(initial.kind) : String(initial.port));
  let auth = $state<AuthInput>(authOf(initial));
  const qrAvailable = qrScanAvailable();

  const startScan = async () => {
    const raw = await scanQr();
    if (raw) applyQr(raw);
  };

  const applyQr = (raw: string) => {
    const scanned = parseEnvironmentQr(raw);
    if (!scanned) return;
    kind = scanned.address.kind;
    host = scanned.address.host;
    port = scanned.address.kind === "https" ? "" : scanned.address.port;
    auth = scanned.auth;
    if (!name.trim()) name = scanned.name;
  };
  let directory = $state(initial.directory);
  let accent = $state<string | null>(initial.accent);
  let picking = $state(false);
  let browsing = $state(false);

  const onHost = (input: string) => {
    const parsed = parseHostInput(input);
    if (!parsed) {
      host = input;
      return;
    }
    host = parsed.host;
    port = parsed.port;
    kind = parsed.kind;
  };

  const onKind = (value: string) => {
    if (value === kind) return;
    kind = value as EnvironmentProfile["kind"];
    port = defaultPortFor(kind);
  };

  const save = () => {
    const target = addressFields(parseHostInput(host) ?? { kind, host: host.trim().replace(/\/+$/, ""), port });
    onSave({
      ...initial,
      ...target,
      name: name.trim() || target.host,
      ...authFields(auth),
      directory: directory.trim(),
      accent,
    });
  };
</script>

<CompactDialog title={isNew ? t("ADD_ENVIRONMENT") : t("EDIT_ENVIRONMENT")} {onDismiss}>
  {#snippet titleTrailing()}
    {#if qrAvailable}
      <TooltipIconButton label={t("SCAN_QR")} onclick={() => void startScan()}>
        <ScanQrCode />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} enabled={!!host.trim()}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    <SelectField label={t("ENVIRONMENT_KIND")} selected={kind} options={KIND_OPTIONS} onSelect={onKind} />
    <InputField value={name} oninput={(value) => (name = value)} label={t("ENVIRONMENT_NAME")} optional singleLine autofocus />
    <div class={FIELD_ROW_CLASS}>
      <InputField value={host} oninput={onHost} label={t("HOST")} singleLine class={FIELD_WIDE_CLASS} />
      {#if kind === "http"}
        <InputField
          value={port}
          oninput={(value) => (port = value.replace(/\D/g, ""))}
          label={t("PORT")}
          singleLine
          class={FIELD_PORT_CLASS}
        />
      {/if}
    </div>
    <AuthFields value={auth} kinds={ENVIRONMENT_AUTH_KINDS} onChange={(next) => (auth = next)} />
    <InputField
      value={directory}
      oninput={(value) => (directory = value)}
      label={t("ENVIRONMENT_DIRECTORY")}
      optional
      singleLine
    >
      {#snippet trailing()}
        {#if isActive}
          <TooltipIconButton
            label={t("CHOOSE")}
            onclick={() => (browsing = true)}
          >
            <Folder />
          </TooltipIconButton>
        {/if}
        <TooltipIconButton
          label={settings.lockedProject ? t("UNLOCK_SELECTION") : t("LOCK_SELECTION")}
          enabled={!!settings.lockedProject || directory.trim() !== ""}
          onclick={() =>
            (settings.lockedProject = settings.lockedProject ? "" : projectKeyOf(directory.trim()))}
        >
          {#if settings.lockedProject}
            <Lock class="text-accent" />
          {:else}
            <LockOpen />
          {/if}
        </TooltipIconButton>
      {/snippet}
    </InputField>
    <SelectField
      label={t("ENVIRONMENT_ACCENT")}
      selected={accentLabel(accent)}
      onclick={() => (picking = true)}
    >
      {#snippet trailing()}
        {#if accent !== null}
          <span class="flex size-8 shrink-0 items-center justify-center">
            <span class="size-4.5 rounded-full" style="background: {theme.resolve(accent)}"></span>
          </span>
        {/if}
      {/snippet}
    </SelectField>
  </div>
</CompactDialog>

{#if browsing}
  <PathPickerDialog
    start={directory}
    onConfirm={(chosen) => {
      directory = chosen;
      browsing = false;
    }}
    onDismiss={() => (browsing = false)}
  />
{/if}

{#if picking}
  <AccentDialog
    title={t("ENVIRONMENT_ACCENT")}
    selected={accent}
    showNone
    closeOnPick
    onSelect={(choice) => (accent = choice)}
    onDismiss={() => (picking = false)}
  />
{/if}
