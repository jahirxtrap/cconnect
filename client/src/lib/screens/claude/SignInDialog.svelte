<script lang="ts">
  import ClipboardPaste from "@lucide/svelte/icons/clipboard-paste";
  import { t } from "$lib/i18n/index.svelte";
  import { openExternal } from "$lib/platform";
  import { pasteText } from "$lib/platform/clipboard";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import CopyField from "$lib/ui/CopyField.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    title: string;
    confirmLabel: string;
    hint: string;
    url: string;
    field: string;
    busy?: boolean;
    error?: string | null;
    onSubmit: (value: string) => void;
    onDismiss: () => void;
  }

  const { title, confirmLabel, hint, url, field, busy = false, error = null, onSubmit, onDismiss }: Props = $props();

  let value = $state("");

  const paste = async () => {
    const text = (await pasteText()).trim();
    if (text) value = text;
  };
</script>

<CompactDialog {title} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onSubmit(value.trim())} enabled={!!value.trim() && !busy}>{confirmLabel}</Button>
  {/snippet}
  <p class="text-body-md">{hint}</p>
  <div class="mt-3">
    <CopyField value={url} url />
  </div>
  <ActionButton text={t("OPEN")} onclick={() => openExternal(url)} class="mt-2 w-full" />
  <div class="mt-3">
    <InputField {value} oninput={(next) => (value = next)} label={field} singleLine>
      {#snippet trailing()}
        <TooltipIconButton label={t("PASTE")} tooltip={false} onclick={paste}>
          <ClipboardPaste />
        </TooltipIconButton>
      {/snippet}
    </InputField>
  </div>
  {#if busy}
    <LinearProgress class="mt-3" />
  {/if}
  {#if error}
    <ErrorText text={error} class="mt-2" />
  {/if}
</CompactDialog>
