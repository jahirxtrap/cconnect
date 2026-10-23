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

<PopupMenu {open} {onOpenChange} label={t("MORE_OPTIONS")}>
  {#snippet triggerChild(props)}
    <TooltipIconButton label={t("MORE_OPTIONS")} tooltip={false} class={className} {...props}>
      <EllipsisVertical />
    </TooltipIconButton>
  {/snippet}
  <MenuItem icon={Pencil} text={t("RENAME")} onclick={() => (renaming = true)} />
  <MenuItem icon={Download} text={t("SAVE")} onclick={() => saveTextToDownloads(filename, note.body)} />
  <MenuItem icon={Save} text={t("SAVE_AS")} onclick={() => void saveTextAs(filename, note.body)} />
  <MenuItem icon={Share2} text={t("SHARE")} onclick={() => void shareText(filename, note.body)} />
  {#if duplicable}
    <MenuItem icon={Copy} text={t("DUPLICATE")} onclick={() => notes.duplicate(note.id)} />
  {/if}
  <MenuItem icon={Trash2} danger text={t("DELETE")} onclick={() => (deleting = true)} />
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
    danger
    onConfirm={() => {
      deleting = false;
      onDeleted();
      notes.remove(note.id);
    }}
    onDismiss={() => (deleting = false)}
  />
{/if}
