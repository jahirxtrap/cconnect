<script lang="ts">
  import EllipsisVertical from "@lucide/svelte/icons/ellipsis-vertical";
  import { t } from "$lib/i18n/index.svelte";
  import { textBlob } from "$lib/services/sharedFiles";
  import FileActionItems from "$lib/ui/FileActionItems.svelte";
  import { FILE_ACTIONS, fileEntries, type FileActionEntry } from "$lib/ui/sharedFileActions";
  import PopupMenu from "$lib/ui/PopupMenu.svelte";
  import RenameDialog from "$lib/ui/RenameDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { undoNotice } from "$lib/ui/undoNotice.svelte";
  import { noteLabel, notes, noteTitle, type Note } from "./notes.svelte";

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

  const filename = $derived(t("NOTES_FILENAME"));

  const actions = $derived<FileActionEntry[]>([
    { id: "rename", run: () => (renaming = true) },
    ...fileEntries(FILE_ACTIONS, { blob: textBlob(note.body) }, filename),
    ...(duplicable ? [{ id: "duplicate" as const, run: () => notes.duplicate(note.id) }] : []),
    { id: "delete", run: () => remove() },
  ]);

  const remove = () => {
    const removed = $state.snapshot(note);
    onDeleted();
    notes.remove(removed.id);
    undoNotice.offer(t("NOTE_DELETED", noteLabel(removed)), () => notes.restore(removed));
  };
</script>

<PopupMenu {open} {onOpenChange} label={t("MORE_OPTIONS")}>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} class={className} {...props}>
      <EllipsisVertical />
    </TooltipIconButton>
  {/snippet}
  <FileActionItems {actions} />
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
