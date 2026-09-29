<script lang="ts">
  import type { AuthInput, AuthKind } from "$lib/data/auth";
  import { t } from "$lib/i18n/index.svelte";
  import InputField from "./InputField.svelte";
  import SelectField from "./SelectField.svelte";

  interface Props {
    value: AuthInput;
    kinds: AuthKind[];
    onChange: (value: AuthInput) => void;
  }

  const { value, kinds, onChange }: Props = $props();

  const LABELS: Record<AuthKind, string> = {
    none: "AUTH_NONE",
    bearer: "AUTH_BEARER",
    api_key: "AUTH_API_KEY",
    basic: "AUTH_BASIC",
    header: "AUTH_HEADER",
  };

  const options = $derived(kinds.map((kind) => ({ value: kind, label: t(LABELS[kind]) })));

  const edit = (patch: Partial<AuthInput>) => onChange({ ...value, ...patch });
</script>

<SelectField
  label={t("ENVIRONMENT_AUTH")}
  selected={value.kind}
  {options}
  onSelect={(kind) => edit({ kind: kind as AuthKind })}
/>
{#if value.kind === "bearer" || value.kind === "api_key"}
  <InputField
    value={value.token}
    oninput={(token) => edit({ token })}
    label={value.kind === "api_key" ? t("AUTH_API_KEY") : t("ENVIRONMENT_TOKEN")}
    singleLine
    secret
  />
{:else if value.kind === "basic"}
  <InputField value={value.user} oninput={(user) => edit({ user })} label={t("AUTH_USER")} singleLine />
  <InputField
    value={value.password}
    oninput={(password) => edit({ password })}
    label={t("AUTH_PASSWORD")}
    singleLine
    secret
  />
{:else if value.kind === "header"}
  <InputField
    value={value.headerName}
    oninput={(headerName) => edit({ headerName })}
    label={t("AUTH_HEADER_NAME")}
    singleLine
  />
  <InputField
    value={value.headerValue}
    oninput={(headerValue) => edit({ headerValue })}
    label={t("AUTH_HEADER_VALUE")}
    singleLine
    secret
  />
{/if}
