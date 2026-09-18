<script lang="ts">
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import Plus from "@lucide/svelte/icons/plus";
  import Rows3 from "@lucide/svelte/icons/rows-3";
  import Search from "@lucide/svelte/icons/search";
  import Type from "@lucide/svelte/icons/type";
  import { t } from "$lib/i18n/index.svelte";
  import { paneActionClass } from "$lib/screens/chat/paneChrome";
  import { inPane } from "$lib/screens/chat/paneSurface";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import NoteMenu from "./NoteMenu.svelte";
  import { notes, type Note } from "./notes.svelte";

  interface Props {
    note: Note | null;
    onNew: () => void;
    onClosed: () => void;
  }

  const { note, onNew, onClosed }: Props = $props();

  let menu = $state(false);

  const actionClass = paneActionClass(inPane());
</script>

{#if note}
  <TooltipIconButton
    label={t("FORMATTED_VIEW")}
    class={actionClass}
    onclick={() => (notes.formatted = !notes.formatted)}
  >
    <Type class={notes.formatted ? "text-accent" : ""} />
  </TooltipIconButton>
  <NoteMenu
    {note}
    open={menu}
    onOpenChange={(open) => (menu = open)}
    onDeleted={onClosed}
    class={actionClass}
  />
{:else}
  <TooltipIconButton label={t("SEARCH")} class={actionClass} onclick={() => notes.search(!notes.searching)}>
    <Search class={notes.searching ? "text-accent" : ""} />
  </TooltipIconButton>
  <TooltipIconButton
    label={t(notes.view === "cards" ? "VIEW_AS_LIST" : "VIEW_AS_CARDS")}
    class={actionClass}
    onclick={() => notes.show(notes.view === "cards" ? "list" : "cards")}
  >
    {#if notes.view === "cards"}
      <Rows3 />
    {:else}
      <LayoutGrid />
    {/if}
  </TooltipIconButton>
  <TooltipIconButton label={t("NEW_NOTE")} class={actionClass} onclick={onNew}>
    <Plus />
  </TooltipIconButton>
{/if}
