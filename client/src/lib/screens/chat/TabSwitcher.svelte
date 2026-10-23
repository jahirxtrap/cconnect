<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Square from "@lucide/svelte/icons/square";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { pushDismiss } from "$lib/app/dismissStack";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import { ReorderDrag } from "$lib/ui/reorderDrag.svelte";
  import { SECTION_LABEL_CLASS } from "$lib/ui/sectionLabel";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import { tabs, type Tab } from "./tabs.svelte";

  let open = $state(false);

  $effect(() => {
    if (!open) return;
    return pushDismiss(() => (open = false));
  });

  const paneDrag = (items: () => Tab[]) =>
    new ReorderDrag(items, (id, to) => tabs.move(id, to), (id) => {
      panes.reveal(id);
      open = false;
    });

  const centerDrag = paneDrag(() => tabs.center);
  const rightDrag = paneDrag(() => tabs.right);

  const groups = $derived(
    [
      { label: t("PANEL_CENTER"), items: tabs.center, drag: centerDrag },
      { label: t("PANEL_RIGHT"), items: tabs.right, drag: rightDrag },
    ].filter((group) => group.items.length),
  );

  const closeTab = (id: string) => {
    const shown = id === panes.focusedTab?.id;
    panes.close(id);
    if (shown) open = false;
  };
</script>

<TooltipIconButton label={t("TABS")} onclick={() => (open = true)}>
  <span class="relative inline-flex">
    <Square />
    <span class="absolute inset-0 flex items-center justify-center text-label-sm leading-none">
      {tabs.list.length}
    </span>
  </span>
</TooltipIconButton>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Content
      onOpenAutoFocus={(event) => event.preventDefault()}
      class="safe-area above-keyboard fixed inset-0 z-50 flex flex-col bg-background text-on-surface"
      aria-label={t("TABS")}
    >
      <AppTopBar title={t("TABS")}>
        {#snippet navigationIcon()}
          <TooltipIconButton label={t("BACK")} onclick={() => (open = false)}>
            <X />
          </TooltipIconButton>
        {/snippet}
        {#snippet actions()}
          <TooltipIconButton
            label={t("NEW_TAB")}
            onclick={() => {
              panes.newTab();
              open = false;
            }}
          >
            <Plus />
          </TooltipIconButton>
        {/snippet}
      </AppTopBar>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {#each groups as group (group.label)}
          {#if groups.length > 1}
            <p class="px-1 pt-1 pb-1.5 {SECTION_LABEL_CLASS}">{group.label}</p>
          {/if}
          <div class="grid grid-cols-2 content-start gap-1.5">
            {#each group.items as tab, index (tab.id)}
              {@render chatCard(tab, index, group.drag)}
            {/each}
          </div>
        {/each}

      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

{#snippet chatCard(tab: Tab, index: number, drag: ReorderDrag)}
  {@const shift = drag.shiftOf(tab.id, index)}
  <div
    use:drag.register={tab.id}
    role="button"
    tabindex="0"
    onpointerdown={(event) => drag.onPointerDown(event, tab.id)}
    onkeydown={(event) => {
      if (event.key !== "Enter") return;
      panes.reveal(tab.id);
      open = false;
    }}
    style="transform: translate({shift.x}px, {shift.y}px); z-index: {tab.id === drag.draggingId
      ? 1
      : 0}; transition: {drag.transitionOf(tab.id)}"
    class="ripple flex min-h-10 cursor-pointer touch-none items-center gap-1.5 rounded-panel pr-1 pl-2.5 {tab.id ===
    panes.focusedTab?.id
      ? 'bg-surface-variant text-on-surface'
      : 'bg-surface text-on-surface-variant'}"
  >
    <StatusDot class="bg-faint" color={sessionColorOf(tab.color)} />
    <span class="min-w-0 flex-1 truncate text-body-md">{tab.title ?? t("NEW_CHAT")}</span>
    <button
      type="button"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={() => closeTab(tab.id)}
      aria-label={t("CLOSE_TAB")}
      class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-hover"
    >
      <X size={16} />
    </button>
  </div>
{/snippet}
