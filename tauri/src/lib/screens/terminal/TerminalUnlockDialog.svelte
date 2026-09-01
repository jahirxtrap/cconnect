<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";

  interface Props {
    rejected?: boolean;
    onConfirm: (key: string) => void;
    onDismiss: () => void;
  }

  const { rejected = false, onConfirm, onDismiss }: Props = $props();

  let key = $state("");
</script>

<CompactDialog title={t("TERMINAL_LOCKED")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(key.trim())} enabled={!!key.trim()}>{t("UNLOCK")}</Button>
  {/snippet}
  <div class="flex flex-col gap-2">
    <InputField value={key} oninput={(value) => (key = value)} label={t("TERMINAL_KEY")} singleLine secret />
    {#if rejected}
      <p class="text-body-sm text-error">{t("TERMINAL_KEY_REJECTED")}</p>
    {/if}
  </div>
</CompactDialog>
