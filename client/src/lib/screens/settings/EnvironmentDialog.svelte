<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import Lock from "@lucide/svelte/icons/lock";
  import LockOpen from "@lucide/svelte/icons/lock-open";
  import ScanQrCode from "@lucide/svelte/icons/scan-qr-code";
  import { untrack } from "svelte";
  import { AUTH_KINDS, type AuthInput } from "$lib/data/auth";
  import { projectKeyOf } from "$lib/data/models";
  import { parseQrPayload } from "$lib/data/qrPayload";
  import { settings } from "$lib/data/settings.svelte";
  import { accentAt, ACCENTS } from "$lib/design/accents";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import type { EnvironmentProfile } from "$lib/services/backend.svelte";
  import { qrScanAvailable, scanQr } from "$lib/services/qrScanner.svelte";
  import AuthFields from "$lib/ui/AuthFields.svelte";
  import Button from "$lib/ui/Button.svelte";
  import AccentDialog from "./AccentDialog.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    profile: EnvironmentProfile;
    isNew: boolean;
    isActive: boolean;
    onSave: (profile: EnvironmentProfile) => void;
    onDismiss: () => void;
  }

  const { profile, isNew, isActive, onSave, onDismiss }: Props = $props();

  const HTTP_PORT = "8723";
  const HTTPS_PORT = "443";
  const RADIX = 10;

  const KIND_OPTIONS = isTauri
    ? [
        { value: "http", label: "HTTP" },
        { value: "https", label: "HTTPS" },
      ]
    : [{ value: "https", label: "HTTPS" }];

  const ENVIRONMENT_AUTH_KINDS = AUTH_KINDS.filter((kind) => kind !== "api_key");

  const defaultPortFor = (kind: string) => (kind === "https" ? HTTPS_PORT : HTTP_PORT);

  interface ParsedHost {
    host: string;
    port: string;
    kind: EnvironmentProfile["kind"];
  }

  const parseHostInput = (input: string): ParsedHost | null => {
    const raw = input.trim();
    const separator = raw.indexOf("://");
    if (separator <= 0) return null;
    const scheme = raw.slice(0, separator).toLowerCase();
    const kind = scheme === "https" || scheme === "wss" ? "https" : scheme === "http" || scheme === "ws" ? "http" : null;
    if (kind === null) return null;
    const secure = kind === "https";
    const rest = raw.slice(separator + 3).split("/")[0].split("?")[0];
    const colon = rest.indexOf(":");
    if (colon < 0) return { host: rest, port: secure ? HTTPS_PORT : "80", kind };
    const digits = rest.slice(colon + 1).replace(/\D/g, "");
    return { host: rest.slice(0, colon), port: digits || (secure ? HTTPS_PORT : "80"), kind };
  };

  const initial = untrack(() => profile);

  let name = $state(initial.name);
  let kind = $state<EnvironmentProfile["kind"]>(initial.kind);
  let host = $state(initial.host);
  let port = $state(initial.port === null ? defaultPortFor(initial.kind) : String(initial.port));
  let auth = $state<AuthInput>({
    kind: initial.authKind,
    token: initial.authToken,
    user: initial.authUser,
    password: initial.authPassword,
    headerName: initial.authHeaderName,
    headerValue: initial.authHeaderValue,
  });
  const qrAvailable = qrScanAvailable();

  const startScan = async () => {
    const raw = await scanQr();
    if (raw) applyQr(raw);
  };

  const applyQr = (raw: string) => {
    const payload = parseQrPayload(raw);
    if (!payload) return;
    const parsed = parseHostInput(payload.url);
    if (!parsed) return;
    kind = parsed.kind;
    host = parsed.host;
    port = parsed.kind === "https" ? "" : parsed.port;
    auth = { ...auth, kind: "bearer", token: payload.token };
  };
  let directory = $state(initial.directory);
  let accentIndex = $state<number | null>(initial.accentIndex);
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
    const parsed = parseHostInput(host);
    const finalKind = parsed?.kind ?? kind;
    const finalHost = parsed?.host ?? host.trim().replace(/\/+$/, "");
    const finalPort = parsed?.port ?? port;
    onSave({
      ...initial,
      name: name.trim() || finalHost,
      kind: finalKind,
      host: finalHost,
      port: finalKind === "https" ? null : (Number.parseInt(finalPort, RADIX) || Number.parseInt(HTTP_PORT, RADIX)),
      authKind: auth.kind,
      authToken: auth.token.trim(),
      authUser: auth.user.trim(),
      authPassword: auth.password,
      authHeaderName: auth.headerName.trim(),
      authHeaderValue: auth.headerValue.trim(),
      directory: directory.trim(),
      accentIndex,
    });
  };
</script>

<CompactDialog title={isNew ? t("ADD_ENVIRONMENT") : t("EDIT_ENVIRONMENT")} {onDismiss}>
  {#snippet titleTrailing()}
    {#if qrAvailable}
      <TooltipIconButton label={t("SCAN_QR")} onclick={() => void startScan()} class="size-9 [&_svg]:size-5">
        <ScanQrCode size={20} />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} enabled={!!host.trim()}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-full flex-col gap-2">
    <SelectField label={t("ENVIRONMENT_KIND")} selected={kind} options={KIND_OPTIONS} onSelect={onKind} />
    <InputField value={name} oninput={(value) => (name = value)} label={t("ENVIRONMENT_NAME")} singleLine autofocus />
    <InputField value={host} oninput={onHost} label={t("HOST")} singleLine />
    {#if kind === "http"}
      <InputField
        value={port}
        oninput={(value) => (port = value.replace(/\D/g, ""))}
        label={t("PORT")}
        singleLine
      />
    {/if}
    <AuthFields value={auth} kinds={ENVIRONMENT_AUTH_KINDS} onChange={(next) => (auth = next)} />
    <InputField
      value={directory}
      oninput={(value) => (directory = value)}
      label={t("ENVIRONMENT_DIRECTORY")}
      singleLine
    >
      {#snippet trailing()}
        {#if isActive}
          <TooltipIconButton
            label={t("CHOOSE")}
            onclick={() => (browsing = true)}
            class="size-6 [&_svg]:size-[18px]"
          >
            <Folder size={18} class="text-on-surface-variant" />
          </TooltipIconButton>
        {/if}
        <TooltipIconButton
          label={settings.lockedProject ? t("UNLOCK_SELECTION") : t("LOCK_SELECTION")}
          enabled={!!settings.lockedProject || directory.trim() !== ""}
          onclick={() =>
            (settings.lockedProject = settings.lockedProject ? "" : projectKeyOf(directory.trim()))}
          class="size-6 [&_svg]:size-[18px]"
        >
          {#if settings.lockedProject}
            <Lock size={18} class="text-accent" />
          {:else}
            <LockOpen size={18} class="text-on-surface-variant" />
          {/if}
        </TooltipIconButton>
      {/snippet}
    </InputField>
    <SelectField
      label={t("ENVIRONMENT_ACCENT")}
      selected={accentIndex === null ? t("COLOR_NONE") : (ACCENTS[accentIndex]?.name ?? "")}
      onclick={() => (picking = true)}
    >
      {#snippet trailing()}
        {#if accentIndex !== null}
          <StatusDot color={accentAt(accentIndex)} box={20} dot={20} />
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
    selected={accentIndex}
    showNone
    closeOnPick
    onSelect={(index) => (accentIndex = index)}
    onDismiss={() => (picking = false)}
  />
{/if}
