<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import { loadFileInfo, type FileInfo } from "$lib/services/fileInfo";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog, { DIALOG_STATE_CLASS } from "$lib/ui/CompactDialog.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import InfoRow from "$lib/ui/InfoRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import { fileInfoSections } from "./fileInfoSections";

  interface Props {
    url: string;
    filename: string;
    onDismiss: () => void;
  }

  const { url, filename, onDismiss }: Props = $props();

  let info = $state<FileInfo | null | undefined>(undefined);

  const sections = $derived(info ? fileInfoSections(info) : []);

  $effect(() => {
    const target = url;
    let active = true;
    info = undefined;
    void loadFileInfo(target).then((found) => {
      if (active) info = found;
    });
    return () => {
      active = false;
    };
  });
</script>

<CompactDialog title={filename} subtitle={t("INFORMATION")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  {#if !info}
    <EmptyState loading={info === undefined} text={t("FILE_INFO_UNAVAILABLE")} class={DIALOG_STATE_CLASS} />
  {:else}
    <div class="flex flex-col gap-1 pb-1">
      {#each sections as group (group.title)}
        <SettingsGroup label={group.title}>
          {#each group.lines as entry (entry.label)}
            <InfoRow label={entry.label} value={entry.value} class="selectable px-3" />
          {/each}
        </SettingsGroup>
      {/each}
    </div>
  {/if}
</CompactDialog>
