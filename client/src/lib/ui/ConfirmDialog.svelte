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
    children?: Snippet;
  }

  const { title, text, confirmLabel, onConfirm, onDismiss, children }: Props = $props();
</script>

<CompactDialog {title} description={text} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={onConfirm}>{confirmLabel}</Button>
  {/snippet}
  {#if children}
    {@render children()}
  {/if}
</CompactDialog>
