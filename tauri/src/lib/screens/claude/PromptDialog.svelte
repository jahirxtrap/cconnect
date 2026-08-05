<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import { untrack } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    initial: string;
    title: string;
    summary: string;
    onConfirm: (text: string) => void;
    onDismiss: () => void;
  }

  const { initial, title, summary, onConfirm, onDismiss }: Props = $props();

  const MIN_LINES = 6;

  let text = $state(untrack(() => initial));
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet titleTrailing()}
    <TooltipIconButton label={t("CLEAR")} enabled={!!text} onclick={() => (text = "")}>
      <Eraser size={20} />
    </TooltipIconButton>
  {/snippet}
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(text)} variant="filled">{t("SAVE")}</Button>
  {/snippet}
  <p class="text-body-sm text-on-surface-variant">{summary}</p>
  <div class="mt-2.5">
    <InputField value={text} oninput={(value) => (text = value)} minLines={MIN_LINES} />
  </div>
</CompactDialog>
