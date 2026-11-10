<script lang="ts">
  import NotepadText from "@lucide/svelte/icons/notepad-text";
  import { formatRecent } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import EmptyState, { NO_RESULTS_ICON } from "$lib/ui/EmptyState.svelte";
  import Pressable from "$lib/ui/Pressable.svelte";
  import { viewportScrollbar } from "$lib/ui/scrollbar";
  import { scrollMemory } from "$lib/ui/scrollMemory";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import NoteMenu from "./NoteMenu.svelte";
  import { noteLabel, notePreview, notes, type Note } from "./notes.svelte";

  interface Props {
    onOpen: (id: string) => void;
    selectedId?: string | null;
    column?: boolean;
  }

  const { onOpen, selectedId = null, column = false }: Props = $props();

  const INSET = "px-(--page-inset) pb-(--page-inset)";

  let menuId = $state<string | null>(null);

  const listed = $derived(notes.listed);
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
    class="group relative shrink-0 rounded-md hover:transition-colors {note.id === selectedId
      ? 'bg-surface-variant'
      : 'hover:bg-hover'}"
  >
    <Pressable
      onclick={() => onOpen(note.id)}
      onlongclick={() => (menuId = note.id)}
      oncontextmenu={() => (menuId = note.id)}
      hover={false}
      class="flex w-full flex-col rounded-md px-3 py-2"
    >
      <span class="truncate pr-6 text-label-lg">{noteLabel(note)}</span>
      {#if preview}
        <span class="truncate text-body-sm text-on-surface-variant">{preview}</span>
      {/if}
      <span class="truncate text-caption text-faint">{formatRecent(note.updatedAt)}</span>
    </Pressable>
    {@render menu(note, "top-1.5 right-1.5", "size-6")}
  </div>
{/snippet}

{#snippet card(note: Note)}
  <div class="group relative">
    <CardPanel
      onclick={() => onOpen(note.id)}
      onlongclick={() => (menuId = note.id)}
      oncontextmenu={() => (menuId = note.id)}
      class="h-40"
    >
      <span class="truncate pr-6 text-label-lg">{noteLabel(note)}</span>
      <span class="line-clamp-4 min-h-0 flex-1 text-body-sm text-on-surface-variant">{notePreview(note.body)}</span>
      <span class="truncate text-caption text-faint">{formatRecent(note.updatedAt)}</span>
    </CardPanel>
    {@render menu(note, "top-2 right-2", "size-7")}
  </div>
{/snippet}

{#if column}
  <div class="flex max-h-full min-h-0 flex-col self-start overflow-hidden rounded-panel bg-card">
    <div
      use:viewportScrollbar
      class="rounded-viewport flex min-h-0 flex-col gap-px overflow-y-auto p-1 [--viewport-inset:0px]"
    >
      {#each listed as note (note.id)}
        {@render row(note)}
      {:else}
        <EmptyState
          icon={notes.searching ? NO_RESULTS_ICON : NotepadText}
          text={t(notes.searching ? "NO_RESULTS" : "NOTES_EMPTY")}
          class="py-8"
        />
      {/each}
    </div>
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
      <EmptyState icon={NO_RESULTS_ICON} text={t("NO_RESULTS")} class="flex-1" />
    {:else}
      <EmptyState icon={NotepadText} text={t("NOTES_EMPTY")} class="flex-1" />
    {/if}
  {:else if notes.cards}
    <div
      use:viewportScrollbar
      use:scrollMemory={"notes|cards"}
      class="rounded-viewport min-h-0 flex-1 overflow-y-auto {INSET}"
    >
      <div class="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {#each listed as note (note.id)}
          {@render card(note)}
        {/each}
      </div>
    </div>
  {:else}
    <div
      use:viewportScrollbar
      use:scrollMemory={"notes|rows"}
      class="rounded-viewport min-h-0 flex-1 overflow-y-auto {INSET}"
    >
      <div class="flex flex-col rounded-panel bg-card p-1">
        {#each listed as note (note.id)}
          {@render row(note)}
        {/each}
      </div>
    </div>
  {/if}
{/if}
