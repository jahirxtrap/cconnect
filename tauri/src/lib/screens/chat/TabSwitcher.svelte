<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Square from "@lucide/svelte/icons/square";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import X from "@lucide/svelte/icons/x";
  import { Dialog } from "bits-ui";
  import { navigation } from "$lib/app/navigation.svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { terminalTabs, type TerminalTab } from "$lib/data/terminalTabs.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { ReorderDrag } from "$lib/ui/reorderDrag.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { panes } from "./panes.svelte";
  import { tabs, type Tab } from "./tabs.svelte";

  interface Props {
    cwd: string[];
  }

  const { cwd }: Props = $props();

  let open = $state(false);
  let closingTerminal = $state<TerminalTab | null>(null);

  const showTerminal = (id: string) => {
    terminalTabs.select(id);
    navigation.pushLayer();
    terminalTabs.overlayOpen = true;
    open = false;
  };

  const newTerminal = async () => {
    const created = await terminalTabs.create(cwd);
    if (created) terminalTabs.select(created.id);
    navigation.pushLayer();
    terminalTabs.overlayOpen = true;
    open = false;
  };

  const closeTerminalTab = async (tab: TerminalTab) => {
    if (await terminalTabs.needsConfirm(tab)) closingTerminal = tab;
    else await terminalTabs.drop(tab);
  };

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

  const terminalDrag = new ReorderDrag(
    () => terminalTabs.items,
    (id, to) => terminalTabs.move(id, to),
    (id) => showTerminal(id),
  );
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
      class="safe-area fixed inset-0 z-50 flex flex-col bg-surface text-on-surface"
      aria-label={t("TABS")}
    >
      <div class="flex shrink-0 items-center px-1.5 py-1.5">
        <TooltipIconButton label={t("BACK")} onclick={() => (open = false)}>
          <X size={24} />
        </TooltipIconButton>
        <Dialog.Title class="flex-1 pl-1.5 text-title-lg">{t("TABS")}</Dialog.Title>
        <TooltipIconButton
          label={t("NEW_TAB")}
          onclick={() => {
            panes.newTab();
            open = false;
          }}
        >
          <Plus size={24} />
        </TooltipIconButton>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {#each groups as group (group.label)}
          {#if groups.length > 1}
            <p class="px-1 pt-1 pb-1.5 text-label-md text-on-surface-variant">{group.label}</p>
          {/if}
          <div class="grid grid-cols-2 content-start gap-1.5">
            {#each group.items as tab, index (tab.id)}
              {@render chatCard(tab, index, group.drag)}
            {/each}
          </div>
        {/each}

        <div class="mt-3 border-t border-outline-variant pt-3">
          <p class="px-1 pb-1.5 text-label-md text-on-surface-variant">{t("TERMINAL")}</p>
          <div class="flex flex-col gap-1.5">
            {#each terminalTabs.items as tab, index (tab.id)}
              {@const shift = terminalDrag.shiftOf(tab.id, index)}
              <div
                use:terminalDrag.register={tab.id}
                role="button"
                tabindex="0"
                onpointerdown={(event) => terminalDrag.onPointerDown(event, tab.id)}
                onkeydown={(event) => event.key === "Enter" && showTerminal(tab.id)}
                style="transform: translate({shift.x}px, {shift.y}px); z-index: {tab.id ===
                terminalDrag.draggingId
                  ? 1
                  : 0}; transition: {terminalDrag.transitionOf(tab.id)}"
                class="flex min-h-10 cursor-pointer touch-none items-center gap-1.5 rounded-item border pr-1 pl-2.5 transition-[background-color,border-color] {tab.id ===
                terminalTabs.activeId
                  ? 'border-[1.5px] border-accent bg-surface-variant text-on-surface'
                  : 'border-outline-variant text-on-surface-variant'}"
              >
                <SquareTerminal size={16} class="shrink-0" />
                <span class="min-w-0 flex-1 truncate text-label-lg">{tab.title}</span>
                <button
                  type="button"
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={() => void closeTerminalTab(tab)}
                  aria-label={t("CLOSE")}
                  class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
                >
                  <X size={18} />
                </button>
              </div>
            {/each}
            <button
              type="button"
              onclick={() => void newTerminal()}
              class="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-item border border-outline-variant pr-1 pl-2.5 text-on-surface-variant"
            >
              <Plus size={16} class="shrink-0" />
              <span class="min-w-0 flex-1 truncate text-left text-label-lg">{t("NEW_TERMINAL")}</span>
            </button>
          </div>
        </div>
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
    class="flex min-h-10 cursor-pointer touch-none items-center gap-1.5 rounded-item border pr-1 pl-2.5 transition-[background-color,border-color] {tab.id ===
    panes.focusedTab?.id
      ? 'border-[1.5px] border-accent bg-surface-variant text-on-surface'
      : 'border-outline-variant text-on-surface-variant'}"
  >
    <span
      class="size-2 shrink-0 rounded-full"
      style={sessionColorOf(tab.color)
        ? `background: ${sessionColorOf(tab.color)}`
        : "background: rgba(var(--c-on-surface-variant-rgb), 0.4)"}
    ></span>
    <span class="min-w-0 flex-1 truncate text-label-lg">{tab.title ?? t("NEW_CHAT")}</span>
    <button
      type="button"
      onpointerdown={(event) => event.stopPropagation()}
      onclick={() => closeTab(tab.id)}
      aria-label={t("CLOSE_TAB")}
      class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
    >
      <X size={18} />
    </button>
  </div>
{/snippet}

{#if closingTerminal}
  {@const tab = closingTerminal}
  <ConfirmDialog
    title={t("CLOSE")}
    text={t("CLOSE_TERMINAL_CONFIRM", tab.title)}
    confirmLabel={t("CLOSE")}
    onConfirm={() => {
      closingTerminal = null;
      void terminalTabs.drop(tab);
    }}
    onDismiss={() => (closingTerminal = null)}
  />
{/if}
