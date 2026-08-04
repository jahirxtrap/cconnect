<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";

  interface Props {
    title: string;
    text: string;
    confirmLabel: string;
    onConfirm: () => void;
    onDismiss: () => void;
  }

  const { title, text, confirmLabel, onConfirm, onDismiss }: Props = $props();
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss}>{t("CANCEL")}</Button>
    <Button onclick={onConfirm}>{confirmLabel}</Button>
  {/snippet}
  <p class="text-body-md text-on-surface-variant">{text}</p>
</CompactDialog>
