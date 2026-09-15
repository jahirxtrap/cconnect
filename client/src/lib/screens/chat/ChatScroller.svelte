<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { snapToDevicePixel } from "$lib/ui/gridHeight";
  import { keepFocus } from "$lib/ui/keepFocus";
  import { LOAD_MORE_PX } from "$lib/ui/paging";
  import { scrollbarWidth } from "$lib/ui/scrollbar";

  interface Props {
    follow?: boolean;
    verticalScrollbar?: number;
    hasContent?: boolean;
    bottomInset?: number;
    onScroll?: ((top: number) => void) | null;
    onNearTop?: (() => void) | null;
    onMove?: (() => void) | null;
    children: Snippet;
    header?: Snippet<[HTMLElement]>;
  }

  let {
    follow = $bindable(true),
    verticalScrollbar = $bindable(0),
    hasContent = true,
    bottomInset = 0,
    onScroll = null,
    onNearTop = null,
    onMove = null,
    children,
    header,
  }: Props = $props();

  const AT_BOTTOM_PX = 4;
  const OWN_TOP_PX = 1;
  const SCROLL_BUTTON_GAP = 12;
  const HALF = 2;
  const HEADER_FALLBACK = 40;

  let container = $state<HTMLDivElement | null>(null);
  let content = $state<HTMLDivElement | null>(null);
  let belowFold = $state(0);
  let viewport = $state(0);
  let horizontalScrollbar = $state(0);
  let ownTop = -1;
  let pendingTop: number | null = null;

  let pinned = $state<HTMLElement | null>(null);
  let pinnedPush = $state(0);
  let headerHeight = $state(0);

  const endOf = () => (container ? container.scrollHeight - container.clientHeight : 0);

  export const distanceToBottom = () => (container ? endOf() - container.scrollTop : 0);

  export const distanceToTop = () => container?.scrollTop ?? 0;

  export const atBottom = () =>
    !container || container.scrollHeight <= container.clientHeight || distanceToBottom() <= AT_BOTTOM_PX;

  export const scrollTo = (top: number) => {
    if (!container) return;
    container.scrollTop = Math.max(0, Math.min(top, endOf()));
    ownTop = container.scrollTop;
    follow = distanceToBottom() <= AT_BOTTOM_PX;
  };

  export const scrollToEnd = () => {
    if (!container) return;
    pendingTop = null;
    container.scrollTop = container.scrollHeight;
    ownTop = container.scrollTop;
    follow = true;
  };

  export const holdAt = (top: number) => {
    pendingTop = top;
    scrollTo(top);
  };

  export const scrollFromEnd = (distance: number) => {
    const target = endOf() - distance;
    if (pendingTop === null) scrollTo(target);
    else holdAt(target);
  };

  export const offsetOf = (node: HTMLElement) => node.offsetTop - (content?.offsetTop ?? 0);

  export const topEdge = () => container?.getBoundingClientRect().top;

  export const bringToTop = (node: HTMLElement) => {
    if (!container) return;
    const delta = node.getBoundingClientRect().top - container.getBoundingClientRect().top;
    scrollTo(container.scrollTop + delta);
  };

  export const items = (): HTMLCollection | null => content?.children ?? null;

  export const find = (selector: string) => container?.querySelector<HTMLElement>(selector) ?? null;

  const firstVisible = (): HTMLElement | null => {
    if (!content) return null;
    const items = content.children;
    const top = distanceToTop();
    let low = 0;
    let high = items.length - 1;
    let found: HTMLElement | null = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const node = items[middle] as HTMLElement;
      if (offsetOf(node) + node.offsetHeight > top) {
        found = node;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return found;
  };

  const updatePinned = () => {
    const edge = topEdge();
    const start = header ? firstVisible() : null;
    if (edge === undefined || !start) {
      pinned = null;
      return;
    }
    let candidate: HTMLElement | null = null;
    let push = 0;
    let node: HTMLElement | null = start;
    while (node) {
      const block = node.querySelector<HTMLElement>("[data-block]");
      if (!block) {
        node = node.nextElementSibling as HTMLElement | null;
        continue;
      }
      const box = block.getBoundingClientRect();
      if (box.top - edge >= 0) break;
      if (block.querySelector("[data-block-body]")) {
        const height = headerHeight > 0 ? headerHeight : HEADER_FALLBACK;
        candidate = node;
        push = Math.min(0, snapToDevicePixel(box.bottom - edge - height));
      }
      node = node.nextElementSibling as HTMLElement | null;
    }
    pinned = candidate;
    pinnedPush = push;
  };

  export const refreshHeader = () => updatePinned();

  const measureScrollbar = () => {
    if (!container) return;
    verticalScrollbar = scrollbarWidth(container);
    horizontalScrollbar = container.offsetHeight - container.clientHeight;
  };

  const onscroll = () => {
    if (!container) return;
    measureScrollbar();
    const top = container.scrollTop;
    const ours = Math.abs(top - ownTop) <= OWN_TOP_PX;
    ownTop = -1;
    if (!ours) pendingTop = null;
    onScroll?.(top);
    belowFold = distanceToBottom();
    viewport = container.clientHeight;
    if (!ours) follow = belowFold <= AT_BOTTOM_PX;
    updatePinned();
    onMove?.();
    if (distanceToTop() < LOAD_MORE_PX) onNearTop?.();
  };

  $effect(() => {
    const element = container;
    const inner = content;
    if (!element || !inner) return;
    measureScrollbar();
    const observer = new ResizeObserver(() => {
      measureScrollbar();
      if (pendingTop !== null) scrollTo(pendingTop);
      else if (follow) scrollToEnd();
      belowFold = distanceToBottom();
      viewport = element.clientHeight;
      updatePinned();
      onMove?.();
    });
    observer.observe(element);
    observer.observe(inner);
    return () => observer.disconnect();
  });
</script>

<div class="relative h-full">
  <div
    bind:this={container}
    {onscroll}
    class="selectable flex h-full flex-col overflow-x-hidden overflow-y-auto"
  >
    <div bind:this={content} class="shrink-0">
      {@render children()}
    </div>
  </div>

  {#if pinned && header}
    <div
      bind:clientHeight={headerHeight}
      style="transform: translateY({pinnedPush}px); right: {verticalScrollbar}px"
      class="absolute top-0 left-0 z-10"
    >
      {@render header(pinned)}
    </div>
  {/if}

  {#if !follow && hasContent && viewport > 0 && belowFold > viewport / HALF}
    <button
      type="button"
      use:keepFocus
      onclick={scrollToEnd}
      title={t("SCROLL_TO_BOTTOM")}
      aria-label={t("SCROLL_TO_BOTTOM")}
      style="bottom: {SCROLL_BUTTON_GAP + horizontalScrollbar + bottomInset}px; right: {SCROLL_BUTTON_GAP +
        verticalScrollbar}px"
      class="absolute inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
    >
      <ChevronsDown size={24} />
    </button>
  {/if}
</div>
