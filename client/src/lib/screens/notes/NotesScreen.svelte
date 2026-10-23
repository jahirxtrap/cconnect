<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { onDestroy } from "svelte";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import NotesActions from "./NotesActions.svelte";
  import NotesEditor from "./NotesEditor.svelte";
  import NotesList from "./NotesList.svelte";
  import { notes, noteTitle } from "./notes.svelte";

  const SPLIT_WIDTH = 840;

  let openId = $state<string | null>(null);
  let width = $state(0);

  const split = $derived(!layout.mobile && width >= SPLIT_WIDTH);
  const open = $derived(openId === null ? null : notes.find(openId));
  const editing = $derived(split ? null : open);
  const shown = $derived(open ?? (split ? (notes.listed[0] ?? null) : null));

  const select = (id: string | null) => {
    if (openId && openId !== id) notes.discardEmpty(openId);
    openId = id;
  };

  const close = () => select(null);

  const create = () => select(notes.create());

  $effect(() =>
    navigation.intercept(() => {
      if (!editing) return false;
      close();
      return true;
    }),
  );

  onDestroy(() => {
    if (openId) notes.discardEmpty(openId);
  });
</script>

{#snippet headerActions()}
  <NotesActions note={editing} wide={split} onNew={create} onClosed={close} />
{/snippet}

<div bind:clientWidth={width} class="flex h-full flex-col">
  <AppTopBar
    title={editing ? noteTitle(editing) || t("NOTE_UNTITLED") : t("NOTES")}
    controls={split ? headerActions : undefined}
    actions={split ? undefined : headerActions}
  >
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => (editing ? close() : navigation.back())}>
        <ArrowLeft />
      </TooltipIconButton>
    {/snippet}
  </AppTopBar>

  {#if split && (notes.listed.length || notes.searching)}
    <div
      class="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 px-(--page-inset) pb-(--page-inset)"
    >
      <NotesList column selectedId={shown?.id ?? null} onOpen={select} />
      {#if shown}
        {#key shown.id}
          <NotesEditor note={shown} inset={false}>
            {#snippet actions()}
              <NotesActions note={shown} wide onNew={create} onClosed={close} />
            {/snippet}
          </NotesEditor>
        {/key}
      {:else}
        <div class="rounded-xl bg-card"></div>
      {/if}
    </div>
  {:else if editing}
    <NotesEditor note={editing} />
  {:else}
    <NotesList onOpen={select} onNew={split ? null : create} />
  {/if}
</div>
