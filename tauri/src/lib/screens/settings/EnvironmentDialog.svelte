<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
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

  const KIND_OPTIONS = [
    { value: "http", label: "HTTP" },
    { value: "https", label: "HTTPS" },
  ];

  const AUTH_OPTIONS = [
    { value: "none", label: t("AUTH_NONE") },
    { value: "bearer", label: t("AUTH_BEARER") },
    { value: "basic", label: t("AUTH_BASIC") },
    { value: "header", label: t("AUTH_HEADER") },
  ];

  let draft = $state(untrack(() => ({ ...profile })));

  const patch = (change: Partial<EnvironmentProfile>) => (draft = { ...draft, ...change });
</script>

<CompactDialog title={isNew ? t("ADD_ENVIRONMENT") : t("EDIT_ENVIRONMENT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onSave(draft)} variant="filled" enabled={!!draft.name.trim() && !!draft.host.trim()}>
      {t("SAVE")}
    </Button>
  {/snippet}

  <div class="flex w-96 max-w-full flex-col gap-3">
    <InputField
      value={draft.name}
      oninput={(value) => patch({ name: value })}
      label={t("ENVIRONMENT_NAME")}
      singleLine
      autofocus
    />
    <SelectField
      label={t("ENVIRONMENT_KIND")}
      selected={draft.kind}
      options={KIND_OPTIONS}
      onSelect={(value) => patch({ kind: value as EnvironmentProfile["kind"] })}
    />
    <div class="flex gap-3">
      <InputField
        class="flex-1"
        value={draft.host}
        oninput={(value) => patch({ host: value })}
        label={t("HOST")}
        singleLine
      />
      <InputField
        class="w-24"
        value={draft.port === null ? "" : String(draft.port)}
        oninput={(value) => patch({ port: value.trim() ? Number.parseInt(value, 10) || null : null })}
        label={t("PORT")}
        singleLine
      />
    </div>
    <SelectField
      label={t("ENVIRONMENT_AUTH")}
      selected={draft.authKind}
      options={AUTH_OPTIONS}
      onSelect={(value) => patch({ authKind: value as AuthKind })}
    />
    {#if draft.authKind === "bearer"}
      <InputField
        value={draft.authToken}
        oninput={(value) => patch({ authToken: value })}
        label={t("ENVIRONMENT_TOKEN")}
        singleLine
        secret
      />
    {:else if draft.authKind === "basic"}
      <InputField
        value={draft.authUser}
        oninput={(value) => patch({ authUser: value })}
        label={t("AUTH_USER")}
        singleLine
      />
      <InputField
        value={draft.authPassword}
        oninput={(value) => patch({ authPassword: value })}
        label={t("AUTH_PASSWORD")}
        singleLine
        secret
      />
    {:else if draft.authKind === "header"}
      <InputField
        value={draft.authHeaderName}
        oninput={(value) => patch({ authHeaderName: value })}
        label={t("AUTH_HEADER_NAME")}
        singleLine
      />
      <InputField
        value={draft.authHeaderValue}
        oninput={(value) => patch({ authHeaderValue: value })}
        label={t("AUTH_HEADER_VALUE")}
        singleLine
        secret
      />
    {/if}
    <InputField
      value={draft.directory}
      oninput={(value) => patch({ directory: value })}
      label={t("ENVIRONMENT_DIRECTORY")}
      singleLine
    />
  </div>
</CompactDialog>
