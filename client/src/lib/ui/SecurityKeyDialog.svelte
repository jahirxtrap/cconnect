<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";
  import ErrorText from "./ErrorText.svelte";
  import InputField from "./InputField.svelte";

  interface Props {
    title?: string;
    rejected?: boolean;
    onConfirm: (key: string) => void;
    onDismiss: () => void;
  }

  const { title, rejected = false, onConfirm, onDismiss }: Props = $props();

  let key = $state("");
</script>

<CompactDialog title={title ?? t("SECURITY_KEY")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(key.trim())} enabled={!!key.trim()}>{t("UNLOCK")}</Button>
  {/snippet}
  <div class="flex flex-col gap-2">
    <InputField value={key} oninput={(value) => (key = value)} label={t("SECURITY_KEY")} singleLine secret />
    {#if rejected}
      <ErrorText text={t("SECURITY_KEY_REJECTED")} />
    {/if}
  </div>
</CompactDialog>
