<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Download from "@lucide/svelte/icons/download";
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Save from "@lucide/svelte/icons/save";
  import Share2 from "@lucide/svelte/icons/share-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { t } from "$lib/i18n/index.svelte";
  import { saveTextAs, saveTextToDownloads, shareText } from "$lib/services/sharedFiles";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import MenuItem from "$lib/ui/MenuItem.svelte";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { notes, noteTitle, type Note } from "./notes.svelte";

  interface Props {
    note: Note;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
    duplicable?: boolean;
    class?: string;
  }

  const { note, open, onOpenChange, onDeleted, duplicable = false, class: className = "" }: Props = $props();

  let renaming = $state(false);
  let deleting = $state(false);

  const filename = $derived(t("NOTES_FILENAME"));
</script>

<PopupMenu {open} {onOpenChange} label={t("MORE_OPTIONS")} align="center">
  {#snippet triggerChild(props)}
    <TooltipIconButton
      label={t("MORE_OPTIONS")}
      tooltip={false}
      class="size-8 [&_svg]:size-5 {className}"
      {...props}
    >
      <EllipsisVertical />
    </TooltipIconButton>
  {/snippet}
  <MenuItem text={t("RENAME")} onclick={() => (renaming = true)}>
    {#snippet leading()}
      <Pencil size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
  <MenuItem text={t("SAVE")} onclick={() => saveTextToDownloads(filename, note.body)}>
    {#snippet leading()}
      <Download size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
  <MenuItem text={t("SAVE_AS")} onclick={() => void saveTextAs(filename, note.body)}>
    {#snippet leading()}
      <Save size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
  <MenuItem text={t("SHARE")} onclick={() => void shareText(filename, note.body)}>
    {#snippet leading()}
      <Share2 size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
  {#if duplicable}
    <MenuItem text={t("DUPLICATE")} onclick={() => notes.duplicate(note.id)}>
      {#snippet leading()}
        <Copy size={20} class="shrink-0 text-on-surface-variant" />
      {/snippet}
    </MenuItem>
  {/if}
  <MenuItem text={t("DELETE")} onclick={() => (deleting = true)}>
    {#snippet leading()}
      <Trash2 size={20} class="shrink-0 text-on-surface-variant" />
    {/snippet}
  </MenuItem>
</PopupMenu>

{#if renaming}
  <RenameDialog
    initial={noteTitle(note)}
    title={t("RENAME")}
    onConfirm={(value) => {
      renaming = false;
      notes.rename(note.id, value);
    }}
    onDismiss={() => (renaming = false)}
  />
{/if}

{#if deleting}
  <ConfirmDialog
    title={t("DELETE")}
    text={t("DELETE_NOTE_CONFIRM", noteTitle(note) || t("NOTE_UNTITLED"))}
    confirmLabel={t("DELETE")}
    onConfirm={() => {
      deleting = false;
      onDeleted();
      notes.remove(note.id);
    }}
    onDismiss={() => (deleting = false)}
  />
{/if}
