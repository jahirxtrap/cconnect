<script lang="ts">
  import NotepadText from "@lucide/svelte/icons/notepad-text";
  import Plus from "@lucide/svelte/icons/plus";
  import { formatRecent } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import Button from "$lib/ui/Button.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import NoteMenu from "./NoteMenu.svelte";
  import { notePreview, notes, noteTitle, type Note } from "./notes.svelte";

  interface Props {
    onOpen: (id: string) => void;
    onNew?: (() => void) | null;
    selectedId?: string | null;
    column?: boolean;
  }

  const { onOpen, onNew = null, selectedId = null, column = false }: Props = $props();

  const INSET = "px-(--page-inset) pb-(--page-inset)";

  let menuId = $state<string | null>(null);

  const listed = $derived(notes.listed);

  const titleOf = (note: Note) => noteTitle(note) || t("NOTE_UNTITLED");
</script>

{#snippet menu(note: Note, place: string, size: string)}
  <div class="absolute {place} {isTouch || menuId === note.id ? '' : 'opacity-0 group-hover:opacity-100'}">
    <NoteMenu
      {note}
      open={menuId === note.id}
      onOpenChange={(open) => (menuId = open ? note.id : null)}
      onDeleted={() => (menuId = null)}
      duplicable
      class={size}
    />
  </div>
{/snippet}

{#snippet row(note: Note)}
  {@const preview = notePreview(note.body)}
  <div
    class="group relative shrink-0 rounded-panel transition-colors {note.id === selectedId
      ? 'bg-surface-variant'
      : 'hover:bg-hover'}"
  >
    <Pressable
      onclick={() => onOpen(note.id)}
      onlongclick={() => (menuId = note.id)}
      oncontextmenu={() => (menuId = note.id)}
      hover={false}
      class="flex w-full flex-col gap-0.5 rounded-panel px-3.5 py-3"
    >
      <span class="truncate pr-6 text-label-lg">{titleOf(note)}</span>
      {#if preview}
        <span class="truncate text-body-sm text-on-surface-variant">{preview}</span>
      {/if}
      <span class="truncate text-caption text-faint">{formatRecent(note.updatedAt)}</span>
    </Pressable>
    {@render menu(note, "top-2.5 right-2.5", "size-6")}
  </div>
{/snippet}

{#snippet card(note: Note)}
  <div class="group relative">
    <CardPanel
      onclick={() => onOpen(note.id)}
      onlongclick={() => (menuId = note.id)}
      oncontextmenu={() => (menuId = note.id)}
      class="h-40 gap-1"
    >
      <span class="truncate pr-6 text-label-lg">{titleOf(note)}</span>
      <span class="line-clamp-4 min-h-0 flex-1 text-body-sm text-on-surface-variant">{notePreview(note.body)}</span>
      <span class="truncate text-caption text-faint">{formatRecent(note.updatedAt)}</span>
    </CardPanel>
    {@render menu(note, "top-2 right-2", "size-7")}
  </div>
{/snippet}

{#snippet create()}
  <Button small onclick={() => onNew?.()}>
    <Plus size={16} />
    {t("NEW_NOTE")}
  </Button>
{/snippet}

{#if column}
  <div use:viewportScrollbar class="rounded-viewport scrollbar-thin flex min-h-0 flex-col gap-1 overflow-y-auto [--viewport-inset:0px]">
    {#each listed as note (note.id)}
      {@render row(note)}
    {:else}
      <EmptyState text={t(notes.searching ? "NO_RESULTS" : "NOTES_EMPTY")} class="flex-1" />
    {/each}
  </div>
{:else}
  {#if notes.searching}
    <div class="px-(--page-inset) pb-2">
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
    {#if notes.searching}
      <EmptyState text={t("NO_RESULTS")} class="flex-1" />
    {:else}
      <EmptyState
        icon={NotepadText}
        text={t("NOTES_EMPTY")}
        action={onNew ? create : undefined}
        class="flex-1"
      />
    {/if}
  {:else if notes.cards}
    <div use:viewportScrollbar class="rounded-viewport scrollbar-thin min-h-0 flex-1 overflow-y-auto {INSET}">
      <div class="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {#each listed as note (note.id)}
          {@render card(note)}
        {/each}
      </div>
    </div>
  {:else}
    <div use:viewportScrollbar class="rounded-viewport scrollbar-thin flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto {INSET}">
      {#each listed as note (note.id)}
        {@render row(note)}
      {/each}
    </div>
  {/if}
{/if}
