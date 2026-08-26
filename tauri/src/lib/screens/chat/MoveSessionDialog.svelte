<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import { projectLabel, type ProjectInfo, type SessionInfo } from "$lib/data/models";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import InputField from "$lib/ui/InputField.svelte";
  import PathPickerDialog from "$lib/ui/PathPickerDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    session: SessionInfo;
    projects: ProjectInfo[];
    /** Project path picked in the menu; null asks for a path instead. */
    preset?: string | null;
    onConfirm: (cwd: string) => void;
    onDismiss: () => void;
  }

  const { session, projects, preset = null, onConfirm, onDismiss }: Props = $props();

  let custom = $state("");
  let browsing = $state(false);

  const target = $derived(preset ?? custom.trim());
  // The menu already picked the project, so that case is only confirmed here.
  const targetName = $derived.by(() => {
    if (!preset) return "";
    const found = projects.find((item) => item.path === preset);
    return found ? projectLabel(found) : preset;
  });

  // The path belongs to the machine running the backend, so browsing happens there.
  const pick = () => (browsing = true);
</script>

<CompactDialog title={t("MOVE_TO_PROJECT")} description={preset ? targetName : null} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
    <Button onclick={() => onConfirm(target)} enabled={!!target && target !== session.path}>
      {t("MOVE")}
    </Button>
  {/snippet}
  <div class="flex flex-col gap-2.5">
    {#if !preset}
      <InputField value={custom} oninput={(value) => (custom = value)} singleLine label={t("MOVE_PROJECT_PATH")} autofocus>
        {#snippet trailing()}
          <TooltipIconButton label={t("CHOOSE")} onclick={pick} class="size-6 [&_svg]:size-[18px]">
            <Folder />
          </TooltipIconButton>
        {/snippet}
      </InputField>
    {/if}
    <p class="text-body-sm text-on-surface-variant">{t("MOVE_PROJECT_HINT")}</p>
  </div>
</CompactDialog>

{#if browsing}
  <PathPickerDialog
    start={custom}
    onConfirm={(chosen) => {
      custom = chosen;
      browsing = false;
    }}
    onDismiss={() => (browsing = false)}
  />
{/if}
