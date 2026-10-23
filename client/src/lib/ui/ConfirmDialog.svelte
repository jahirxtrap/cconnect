<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";

  interface Props {
    title: string;
    text: string;
    confirmLabel: string;
    onConfirm: () => void;
    onDismiss: () => void;
    danger?: boolean;
    children?: Snippet;
  }

  const { title, text, confirmLabel, onConfirm, onDismiss, danger = false, children }: Props = $props();
</script>

<CompactDialog {title} description={text} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={onConfirm} variant={danger ? "destructive" : "filled"}>{confirmLabel}</Button>
  {/snippet}
  {#if children}
    {@render children()}
  {/if}
</CompactDialog>
