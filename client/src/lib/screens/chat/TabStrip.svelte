<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { hscrollbar, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import { StripDrag } from "$lib/ui/stripDrag.svelte";
  import { PANE_HEADER_CLASS, PANE_SUB_CLASS, paneDim, paneTabClass } from "./paneChrome";
  import { startPaneDrag, type PaneDrag } from "./paneDrag";
  import { panes } from "./panes.svelte";
  import { usePaneTail } from "./paneSurface";

  export interface StripTab {
    id: string;
    title?: string | null;
    color?: string | null;
  }

  interface Props {
    items: StripTab[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew?: () => void;
    newShortcut?: string;
    onClose: (id: string) => void;
    onMove?: (id: string, index: number) => void;
    onDrop?: () => void;
    onPaneDrag?: PaneDrag;
    onTabDrag?: (id: string, pointerX: number) => boolean;
    group?: string;
    newLabel?: string;
    emptyTitle?: string;
    dot?: boolean;
    sub?: boolean;
    focused?: boolean;
    trailing?: Snippet;
    leading?: Snippet<[string]>;
    lead?: Snippet;
  }

  const {
    items,
    activeId,
    onSelect,
    onNew,
    newShortcut,
    onClose,
    onMove,
    onDrop,
    onPaneDrag,
    onTabDrag,
    group = "tabs",
    newLabel,
    emptyTitle,
    dot = true,
    sub = false,
    focused = false,
    trailing,
    leading,
    lead,
  }: Props = $props();

  const SPACING = 4;
  const HALF = 2;

  let strip = $state<HTMLDivElement | null>(null);
  let plus = $state<HTMLDivElement | null>(null);

  const drag = new StripDrag(() => ({
    group,
    strip,
    onMove,
    onSelect,
    onDrop,
    onCross: onTabDrag ? (id, x) => (onTabDrag(id, x) ? "joined" : "stay") : undefined,
  }));

  const tailOf = usePaneTail();
  const tail = $derived(tailOf());
  const dimmed = $derived(!focused && !sub && panes.split);
  const held = $derived(drag.held);
  const mine = $derived(held !== "" && items.some((tab) => tab.id === held));

  const plusShift = $derived.by(() => {
    if (!mine || !plus) return 0;
    const right = drag.centerOf(held) + drag.widthOf(held) / HALF + drag.dx;
    return Math.max(0, right + SPACING - plus.offsetLeft);
  });

  $effect(() => {
    const id = activeId;
    void items.length;
    if (id !== null) drag.reveal(id);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onpointerdown={(event) => startPaneDrag(event, onPaneDrag)} class={sub && !tail ? PANE_SUB_CLASS : `${PANE_HEADER_CLASS} ${paneDim(dimmed)}`}>
  {#if lead}
    <div class="flex shrink-0 items-center">{@render lead()}</div>
  {/if}
  <div
    bind:this={strip}
    use:hscrollbar={{ wheel: true }}
    role="tablist"
    data-strip={group}
    class="{SCROLL_ROW_CLASS} flex min-w-0 flex-1 items-center gap-1"
  >
    {#each items as tab (tab.id)}
      {@const active = tab.id === activeId}
      {@const dragging = tab.id === held}
      <div
        use:drag.register={tab.id}
        data-tab={tab.id}
        role="tab"
        tabindex={active ? 0 : -1}
        aria-selected={active}
        onpointerdown={(event) => drag.onPointerDown(event, tab.id)}
        onkeydown={(event) => event.key === "Enter" && onSelect(tab.id)}
        style="transform: translateX({dragging ? drag.dx : 0}px); z-index: {dragging ? 1 : 0}"
        class="flex shrink-0 cursor-pointer touch-none items-center gap-2 rounded-full transition-colors select-none {sub
          ? 'h-7 pr-1 pl-2.5 text-body-sm'
          : 'h-8 pr-1.5 pl-3 text-body-md'} {paneTabClass(active, focused)}"
      >
        {#if leading}
          {@render leading(tab.id)}
        {:else if dot}
          <StatusDot class="bg-faint" color={sessionColorOf(tab.color)} />
        {/if}
        <span class="max-w-44 truncate">{tab.title ?? emptyTitle ?? t("NEW_CHAT")}</span>
        <button
          type="button"
          onpointerdown={(event) => event.stopPropagation()}
          onclick={() => onClose(tab.id)}
          aria-label={t("CLOSE_TAB")}
          class="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant opacity-60 transition hover:bg-hover hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
    {/each}
    {#if onNew}
      <div bind:this={plus} style="transform: translateX({plusShift}px)" class="flex shrink-0 items-center">
        <TooltipIconButton
          label={newLabel ?? t("NEW_TAB")}
          shortcut={newShortcut}
          onclick={onNew}
        >
          <Plus />
        </TooltipIconButton>
      </div>
    {/if}
  </div>
  {#if trailing}
    <div class="flex min-w-0 shrink items-center">{@render trailing()}</div>
  {/if}
  {#if tail}
    <div class="flex shrink-0 items-center">{@render tail()}</div>
  {/if}
</div>
