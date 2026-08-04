<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import type { AuthKind, EnvironmentProfile } from "$lib/services/backend.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import SelectField from "$lib/ui/SelectField.svelte";

  interface Props {
    profile: EnvironmentProfile;
    isNew: boolean;
    onSave: (profile: EnvironmentProfile) => void;
    onDismiss: () => void;
  }

  const { profile, isNew, onSave, onDismiss }: Props = $props();

  const HTTP_PORT = "8723";
  const HTTPS_PORT = "443";
  const RADIX = 10;

  const KIND_OPTIONS = isTauri
    ? [
        { value: "http", label: "HTTP" },
        { value: "https", label: "HTTPS" },
      ]
    : [{ value: "https", label: "HTTPS" }];

  const AUTH_OPTIONS = [
    { value: "none", label: t("AUTH_NONE") },
    { value: "bearer", label: t("AUTH_BEARER") },
    { value: "basic", label: t("AUTH_BASIC") },
    { value: "header", label: t("AUTH_HEADER") },
  ];

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
  let authKind = $state<AuthKind>(initial.authKind);
  let authToken = $state(initial.authToken);
  let authUser = $state(initial.authUser);
  let authPassword = $state(initial.authPassword);
  let authHeaderName = $state(initial.authHeaderName);
  let authHeaderValue = $state(initial.authHeaderValue);
  let directory = $state(initial.directory);

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
      authKind,
      authToken: authToken.trim(),
      authUser: authUser.trim(),
      authPassword,
      authHeaderName: authHeaderName.trim(),
      authHeaderValue: authHeaderValue.trim(),
      directory: directory.trim(),
    });
  };
</script>

<CompactDialog title={isNew ? t("ADD_ENVIRONMENT") : t("EDIT_ENVIRONMENT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={save} variant="filled" enabled={!!host.trim()}>{t("SAVE")}</Button>
  {/snippet}

  <div class="flex w-96 max-w-full flex-col gap-2">
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
    <SelectField
      label={t("ENVIRONMENT_AUTH")}
      selected={authKind}
      options={AUTH_OPTIONS}
      onSelect={(value) => (authKind = value as AuthKind)}
    />
    {#if authKind === "bearer"}
      <InputField
        value={authToken}
        oninput={(value) => (authToken = value)}
        label={t("ENVIRONMENT_TOKEN")}
        singleLine
        secret
      />
    {:else if authKind === "basic"}
      <InputField value={authUser} oninput={(value) => (authUser = value)} label={t("AUTH_USER")} singleLine />
      <InputField
        value={authPassword}
        oninput={(value) => (authPassword = value)}
        label={t("AUTH_PASSWORD")}
        singleLine
        secret
      />
    {:else if authKind === "header"}
      <InputField
        value={authHeaderName}
        oninput={(value) => (authHeaderName = value)}
        label={t("AUTH_HEADER_NAME")}
        singleLine
      />
      <InputField
        value={authHeaderValue}
        oninput={(value) => (authHeaderValue = value)}
        label={t("AUTH_HEADER_VALUE")}
        singleLine
        secret
      />
    {/if}
    <InputField
      value={directory}
      oninput={(value) => (directory = value)}
      label={t("ENVIRONMENT_DIRECTORY")}
      singleLine
    />
  </div>
</CompactDialog>
