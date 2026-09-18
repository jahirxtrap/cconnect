<script lang="ts">
  import StickyNote from "@lucide/svelte/icons/sticky-note";
  import { formatDateShort } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import OutlinedPanel from "$lib/ui/OutlinedPanel.svelte";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import NoteMenu from "./NoteMenu.svelte";
  import { notePreview, notes, noteTitle, type Note } from "./notes.svelte";

  interface Props {
    onOpen: (id: string) => void;
  }

  const { onOpen }: Props = $props();

  let menuId = $state<string | null>(null);

  const listed = $derived(notes.listed);

  const titleOf = (note: Note) => noteTitle(note) || t("NOTE_UNTITLED");
</script>

{#if notes.searching}
  <div class="px-3 py-2">
    <SearchBar
      value={notes.query}
      oninput={(value) => (notes.query = value)}
      placeholder={t("SEARCH")}
      autofocus
      onClose={() => notes.search(false)}
    />
  </div>
{/if}

{#if !listed.length}
  <EmptyState text={t(notes.searching ? "NO_RESULTS" : "NOTES_EMPTY")} class="flex-1" />
{:else if notes.view === "cards"}
  <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {#each listed as note (note.id)}
        <div class="relative">
          <OutlinedPanel
            onclick={() => onOpen(note.id)}
            onlongclick={() => (menuId = note.id)}
            oncontextmenu={() => (menuId = note.id)}
            class="h-40 gap-1"
          >
            <p class="truncate pr-8 text-body-md">{titleOf(note)}</p>
            <p class="line-clamp-4 min-h-0 flex-1 text-body-sm text-on-surface-variant">
              {notePreview(note.body)}
            </p>
            <p class="truncate text-body-sm text-on-surface-variant">{formatDateShort(note.updatedAt)}</p>
          </OutlinedPanel>
          <div class="absolute top-1.5 right-1.5">
            <NoteMenu
              {note}
              open={menuId === note.id}
              onOpenChange={(open) => (menuId = open ? note.id : null)}
              onDeleted={() => (menuId = null)}
              duplicable
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
    {#each listed as note (note.id)}
      <ListRow
        title={titleOf(note)}
        subtitle={formatDateShort(note.updatedAt)}
        icon={StickyNote}
        onclick={() => onOpen(note.id)}
        onlongclick={() => (menuId = note.id)}
        oncontextmenu={() => (menuId = note.id)}
      >
        {#snippet trailing()}
          <NoteMenu
            {note}
            open={menuId === note.id}
            onOpenChange={(open) => (menuId = open ? note.id : null)}
            onDeleted={() => (menuId = null)}
            duplicable
          />
        {/snippet}
      </ListRow>
    {/each}
  </div>
{/if}
