<script module lang="ts">
  const drag = $state({ id: "", group: "", dx: 0 });
</script>

<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { flushSync, type Snippet } from "svelte";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { DRAG_PRESS_MS } from "$lib/ui/press";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import { PANE_HEADER_CLASS, PANE_SUB_CLASS, paneDim, paneTabClass } from "./paneChrome";
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
    onPaneDrag?: (pointerX: number, done: boolean) => void;
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
  const DRAG_THRESHOLD = 8;
  const EDGE = 56;
  const STEP = 12;
  const HALF = 2;

  let strip = $state<HTMLDivElement | null>(null);
  let plus = $state<HTMLDivElement | null>(null);

  let grabX = 0;
  let pointerX = 0;

  const tailOf = usePaneTail();
  const tail = $derived(tailOf());
  const dimmed = $derived(!focused && !sub && panes.split);
  const held = $derived(drag.group === group ? drag.id : "");
  const mine = $derived(held !== "" && items.some((tab) => tab.id === held));

  const onPaneDown = (event: PointerEvent) => {
    if (event.button !== 0 || !onPaneDrag) return;
    if ((event.target as HTMLElement | null)?.closest('[role="tab"], button')) return;
    event.preventDefault();
    const startX = event.clientX;

    const onMovePointer = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      onPaneDrag(move.clientX, false);
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
      window.removeEventListener("pointermove", onMovePointer);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      onPaneDrag(up instanceof PointerEvent ? up.clientX : startX, true);
    };

    window.addEventListener("pointermove", onMovePointer);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const chips = new Map<string, HTMLElement>();

  const register = (element: HTMLElement, id: string) => {
    chips.set(id, element);
    return { destroy: () => chips.delete(id) };
  };

  const widthOf = (id: string) => chips.get(id)?.offsetWidth ?? 0;
  const centerOf = (id: string) => {
    const element = chips.get(id);
    return element ? element.offsetLeft + element.offsetWidth / HALF : 0;
  };

  const dragged = () =>
    document.querySelector<HTMLElement>(`[data-strip="${group}"] [data-tab="${CSS.escape(drag.id)}"]`);

  const rowOf = (chip: HTMLElement) => [
    ...(chip.parentElement?.querySelectorAll<HTMLElement>("[data-tab]") ?? []),
  ];

  const follow = () => {
    const chip = dragged();
    if (!chip) return;
    drag.dx = pointerX - grabX - (chip.getBoundingClientRect().left - drag.dx);
  };

  const reorder = () => {
    const chip = dragged();
    if (!chip || !onMove) return;
    const row = rowOf(chip);
    const from = row.indexOf(chip);
    if (drag.dx > 0 && from < row.length - 1) {
      const width = row[from + 1].offsetWidth;
      if (width > 0 && drag.dx > width / HALF + SPACING) {
        onMove(drag.id, from + 1);
        drag.dx -= width + SPACING;
      }
      return;
    }
    if (drag.dx < 0 && from > 0) {
      const width = row[from - 1].offsetWidth;
      if (width > 0 && drag.dx < -(width / HALF + SPACING)) {
        onMove(drag.id, from - 1);
        drag.dx += width + SPACING;
      }
    }
  };

  const insert = () => {
    const chip = dragged();
    if (!chip || !onMove) return;
    const row = rowOf(chip).filter((node) => node !== chip);
    onMove(
      drag.id,
      row.filter((node) => node.getBoundingClientRect().left + node.offsetWidth / HALF < pointerX).length,
    );
  };

  const maxScroll = (scroller: HTMLElement) => {
    const tail = scroller.lastElementChild as HTMLElement | null;
    return tail ? Math.max(0, tail.offsetLeft + tail.offsetWidth - scroller.clientWidth) : 0;
  };

  const autoScroll = () => {
    const chip = drag.id ? dragged() : null;
    const scroller = chip?.parentElement;
    if (!chip || !scroller) return;
    const viewport = scroller.clientWidth;
    const limit = maxScroll(scroller);
    const visible = chip.getBoundingClientRect().left + chip.offsetWidth / HALF - scroller.getBoundingClientRect().left;
    const direction =
      visible < EDGE && scroller.scrollLeft > 0
        ? -1
        : visible > viewport - EDGE && scroller.scrollLeft < limit
          ? 1
          : 0;
    if (direction !== 0) {
      scroller.scrollLeft = Math.max(0, Math.min(scroller.scrollLeft + direction * STEP, limit));
      follow();
      reorder();
    }
    requestAnimationFrame(autoScroll);
  };

  const startDrag = (id: string, x: number) => {
    const box = chips.get(id)?.getBoundingClientRect();
    grabX = box ? x - box.left : 0;
    pointerX = x;
    drag.id = id;
    drag.group = group;
    drag.dx = 0;
    autoScroll();
  };

  const endDrag = () => {
    if (drag.id) onDrop?.();
    drag.id = "";
    drag.group = "";
    drag.dx = 0;
  };

  const onPointerDown = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const touch = event.pointerType === "touch";
    let started = false;
    let panning = false;
    let lastX = startX;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    if (touch) timer = setTimeout(() => ((started = true), startDrag(id, startX)), DRAG_PRESS_MS);

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      if (!started) {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (touch) {
          if (!panning && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            panning = Math.abs(dx) >= Math.abs(dy);
            if (!panning) {
              detach();
              return;
            }
          }
          if (panning && strip) strip.scrollLeft -= move.clientX - lastX;
          lastX = move.clientX;
          return;
        }
        if (Math.abs(dx) <= DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        started = true;
        lastX = move.clientX;
        startDrag(id, move.clientX);
      }
      pointerX = move.clientX;
      lastX = move.clientX;
      let crossed = false;
      flushSync(() => (crossed = onTabDrag?.(id, pointerX) === true));
      if (crossed) flushSync(insert);
      follow();
      if (!crossed) reorder();
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
      detach();
      if (started) endDrag();
      else if (!panning) onSelect(id);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  };

  const plusShift = $derived.by(() => {
    if (!mine || !plus) return 0;
    const right = centerOf(held) + widthOf(held) / HALF + drag.dx;
    return Math.max(0, right + SPACING - plus.offsetLeft);
  });

  $effect(() => {
    const id = activeId;
    void items.length;
    if (!strip || id === null || drag.id !== "") return;
    const viewport = strip.clientWidth;
    if (viewport <= 0) return;
    const target = centerOf(id) - viewport / HALF;
    strip.scrollTo({
      left: Math.min(Math.max(target, 0), Math.max(strip.scrollWidth - viewport, 0)),
      behavior: "smooth",
    });
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onpointerdown={onPaneDown} class={sub && !tail ? PANE_SUB_CLASS : `${PANE_HEADER_CLASS} ${paneDim(dimmed)}`}>
  {#if lead}
    <div class="flex shrink-0 items-center">{@render lead()}</div>
  {/if}
  <div
    bind:this={strip}
    use:hscrollbar={{ wheel: true }}
    role="tablist"
    data-strip={group}
    class="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
  >
    {#each items as tab (tab.id)}
      {@const active = tab.id === activeId}
      {@const dragging = tab.id === held}
      <div
        use:register={tab.id}
        data-tab={tab.id}
        role="tab"
        tabindex={active ? 0 : -1}
        aria-selected={active}
        onpointerdown={(event) => onPointerDown(event, tab.id)}
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
