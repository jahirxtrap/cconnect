<script lang="ts">
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import InputField from "./InputField.svelte";

  interface Props {
    initial: string;
    onConfirm: (value: string) => void;
    onDismiss: () => void;
    title?: string;
    confirmLabel?: string;
    suffix?: string | null;
    secret?: boolean;
    errorOf?: (value: string) => string | null;
  }

  const {
    initial,
    onConfirm,
    onDismiss,
    title = t("RENAME"),
    confirmLabel = t("SAVE"),
    suffix,
    secret = false,
    errorOf,
  }: Props = $props();

  let text = $state(untrack(() => initial));
  const error = $derived(text.trim() ? (errorOf?.(text) ?? null) : null);
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(text)} enabled={!!text.trim() && !error}>
      {confirmLabel}
    </Button>
  {/snippet}
  <InputField
    value={text}
    oninput={(value) => (text = value)}
    {secret}
    singleLine={secret}
    minLines={secret ? 1 : 2}
    autofocus
  >
    {#snippet trailing()}
      {#if suffix}
        <span class="text-body-md text-on-surface-variant">{suffix}</span>
      {/if}
    {/snippet}
  </InputField>
  {#if error}
    <p class="mt-1.5 text-body-sm text-error">{error}</p>
  {/if}
</CompactDialog>
