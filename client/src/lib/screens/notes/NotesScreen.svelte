<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import NotesActions from "./NotesActions.svelte";
  import NotesEditor from "./NotesEditor.svelte";
  import NotesList from "./NotesList.svelte";
  import { notes, noteTitle } from "./notes.svelte";

  let openId = $state<string | null>(null);

  const open = $derived(openId === null ? null : notes.find(openId));

  const close = () => {
    if (openId) notes.discardEmpty(openId);
    openId = null;
  };

  $effect(() =>
    navigation.intercept(() => {
      if (!open) return false;
      close();
      return true;
    }),
  );
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={open ? noteTitle(open) || t("NOTE_UNTITLED") : t("NOTES")}>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => (open ? close() : navigation.back())}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet actions()}
      <NotesActions note={open} onNew={() => (openId = notes.create())} onClosed={() => (openId = null)} />
    {/snippet}
  </AppTopBar>

  {#if open}
    <NotesEditor note={open} />
  {:else}
    <NotesList onOpen={(id) => (openId = id)} />
  {/if}
</div>
