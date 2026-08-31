<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { sessionColorOf } from "$lib/design/sessionColors";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import { tabs } from "./tabs.svelte";

  interface Props {
    onSelect: (id: string) => void;
    onNew: () => void;
    onClose: (id: string) => void;
  }

  const { onSelect, onNew, onClose }: Props = $props();

  const SPACING = 6;
  const DRAG_THRESHOLD = 8;
  const EDGE = 56;
  const STEP = 12;
  const LONG_PRESS_MS = 400;
  const HALF = 2;

  let strip = $state<HTMLDivElement | null>(null);
  let plus = $state<HTMLDivElement | null>(null);
  let draggingId = $state<string | null>(null);
  let dragDx = $state(0);

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

  const reorder = (id: string) => {
    const list = tabs.list;
    const from = list.findIndex((tab) => tab.id === id);
    if (from < 0) return;
    if (dragDx > 0 && from < list.length - 1) {
      const width = widthOf(list[from + 1].id);
      if (width > 0 && dragDx > width / HALF + SPACING) {
        tabs.move(id, from + 1);
        dragDx -= width + SPACING;
      }
      return;
    }
    if (dragDx < 0 && from > 0) {
      const width = widthOf(list[from - 1].id);
      if (width > 0 && dragDx < -(width / HALF + SPACING)) {
        tabs.move(id, from - 1);
        dragDx += width + SPACING;
      }
    }
  };

  const maxScroll = () => {
    if (!strip || !plus) return 0;
    return Math.max(0, plus.offsetLeft + plus.offsetWidth - strip.clientWidth);
  };

  const autoScroll = (id: string) => {
    if (draggingId !== id || !strip) return;
    const viewport = strip.clientWidth;
    if (viewport > 0) {
      const limit = maxScroll();
      const visible = centerOf(id) + dragDx - strip.scrollLeft;
      const direction =
        visible < EDGE && strip.scrollLeft > 0
          ? -1
          : visible > viewport - EDGE && strip.scrollLeft < limit
            ? 1
            : 0;
      if (direction !== 0) {
        const before = strip.scrollLeft;
        strip.scrollLeft = Math.max(0, Math.min(before + direction * STEP, limit));
        dragDx += strip.scrollLeft - before;
        reorder(id);
      }
    }
    requestAnimationFrame(() => autoScroll(id));
  };

  const startDrag = (id: string) => {
    draggingId = id;
    dragDx = 0;
    autoScroll(id);
  };

  const endDrag = () => {
    draggingId = null;
    dragDx = 0;
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

    if (touch) timer = setTimeout(() => ((started = true), startDrag(id)), LONG_PRESS_MS);

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
        startDrag(id);
      }
      dragDx += move.clientX - lastX;
      lastX = move.clientX;
      reorder(id);
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
    const id = draggingId;
    if (!id || !plus) return 0;
    const right = centerOf(id) + widthOf(id) / HALF + dragDx;
    return Math.max(0, right + SPACING - plus.offsetLeft);
  });

  $effect(() => {
    const id = tabs.activeId;
    void tabs.list.length;
    if (!strip || draggingId !== null) return;
    const viewport = strip.clientWidth;
    if (viewport <= 0) return;
    const target = centerOf(id) - viewport / HALF;
    strip.scrollTo({
      left: Math.min(Math.max(target, 0), Math.max(strip.scrollWidth - viewport, 0)),
      behavior: "smooth",
    });
  });
</script>

<div
  bind:this={strip}
  use:hscrollbar={{ touchIndicator: false, wheel: true }}
  role="tablist"
  class="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-outline-variant bg-surface px-1 py-1.5"
>
  {#each tabs.list as tab (tab.id)}
    {@const active = tab.id === tabs.activeId}
    {@const dragging = tab.id === draggingId}
    <div
      use:register={tab.id}
      role="tab"
      tabindex={active ? 0 : -1}
      aria-selected={active}
      onpointerdown={(event) => onPointerDown(event, tab.id)}
      onkeydown={(event) => event.key === "Enter" && onSelect(tab.id)}
      style="transform: translateX({dragging ? dragDx : 0}px); z-index: {dragging ? 1 : 0}"
      class="flex h-8 shrink-0 cursor-pointer touch-none items-center gap-1.5 rounded-item pr-1 pl-2.5 transition-colors select-none {active
        ? 'bg-surface-variant text-on-surface'
        : 'text-on-surface-variant hover:bg-on-surface/6'}"
    >
      <span
        class="size-2 shrink-0 rounded-full"
        style={sessionColorOf(tab.color)
          ? `background: ${sessionColorOf(tab.color)}`
          : "background: rgba(var(--c-on-surface-variant-rgb), 0.4)"}
      ></span>
      <span class="max-w-[170px] truncate text-label-lg">{tab.title ?? t("NEW_CHAT")}</span>
      <button
        type="button"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={() => onClose(tab.id)}
        aria-label={t("CLOSE_TAB")}
        class="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10"
      >
        <X size={14} />
      </button>
    </div>
  {/each}
  <div bind:this={plus} style="transform: translateX({plusShift}px)" class="flex h-8 shrink-0 items-center">
    <TooltipIconButton label={t("NEW_TAB")} onclick={onNew} class="size-8">
      <Plus size={18} />
    </TooltipIconButton>
  </div>
</div>
