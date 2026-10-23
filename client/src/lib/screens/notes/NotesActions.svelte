<script lang="ts">
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Plus from "@lucide/svelte/icons/plus";
  import Rows3 from "@lucide/svelte/icons/rows-3";
  import Search from "@lucide/svelte/icons/search";
  import Type from "@lucide/svelte/icons/type";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import SearchBar, { HEADER_SEARCH_CLASS } from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import NoteMenu from "./NoteMenu.svelte";
  import { notes, type Note } from "./notes.svelte";

  interface Props {
    note: Note | null;
    wide?: boolean;
    onNew: () => void;
    onClosed: () => void;
  }

  const { note, wide = false, onNew, onClosed }: Props = $props();

  let menu = $state(false);

  const find = (value: string) => {
    notes.query = value;
    notes.searching = value.length > 0;
  };
</script>

{#snippet create()}
  <TooltipIconButton label={t("NEW_NOTE")} onclick={onNew}>
    <Plus />
  </TooltipIconButton>
{/snippet}

{#if note}
  <TooltipIconButton
    label={t("FORMATTED_VIEW")}
    active={notes.formatted}
    onclick={() => (notes.formatted = !notes.formatted)}
  >
    <Type />
  </TooltipIconButton>
  <NoteMenu {note} open={menu} onOpenChange={(open) => (menu = open)} onDeleted={onClosed} />
{:else if wide}
  <SearchBar value={notes.query} oninput={find} placeholder={t("SEARCH_NOTES")} class={HEADER_SEARCH_CLASS} />
  {@render create()}
{:else}
  <TooltipIconButton label={t("SEARCH")} active={notes.searching} onclick={() => notes.search(!notes.searching)}>
    <Search />
  </TooltipIconButton>
  {#if layout.mobile}
    <TooltipIconButton
      label={t(notes.cards ? "VIEW_AS_LIST" : "VIEW_AS_CARDS")}
      onclick={() => notes.show(notes.cards ? "list" : "cards")}
    >
      {#if notes.cards}
        <Rows3 />
      {:else}
        <LayoutGrid />
      {/if}
    </TooltipIconButton>
  {/if}
  {@render create()}
{/if}
