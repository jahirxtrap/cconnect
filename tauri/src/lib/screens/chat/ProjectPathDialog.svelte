<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    onConfirm: (path: string, name: string) => void;
    onDismiss: () => void;
  }

  const { onConfirm, onDismiss }: Props = $props();

  let path = $state("");
  let name = $state("");
  let browsing = $state(false);

  const pick = () => (browsing = true);
</script>

<CompactDialog title={t("ADD_PROJECT")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(path.trim(), name.trim())} enabled={!!path.trim()}>{t("CREATE")}</Button>
  {/snippet}
  <div class="flex flex-col gap-2.5">
    <InputField value={path} oninput={(value) => (path = value)} singleLine label={t("MOVE_PROJECT_PATH")} autofocus>
      {#snippet trailing()}
        <TooltipIconButton label={t("CHOOSE")} onclick={pick} class="size-6 [&_svg]:size-[18px]">
          <Folder />
        </TooltipIconButton>
      {/snippet}
    </InputField>
    <InputField value={name} oninput={(value) => (name = value)} singleLine label={t("NAME")} />
  </div>
</CompactDialog>

{#if browsing}
  <PathPickerDialog
    start={path}
    onConfirm={(chosen) => {
      path = chosen;
      browsing = false;
    }}
    onDismiss={() => (browsing = false)}
  />
{/if}
