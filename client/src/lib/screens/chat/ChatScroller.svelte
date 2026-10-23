<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import { tick, type Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { keepFocus } from "$lib/ui/keepFocus";
  import { LOAD_MORE_PX } from "$lib/ui/paging";
  import { scrollbarWidth } from "$lib/ui/scrollbar";
  import { provideStickyHeads } from "./blocks/stickyHeads";

  interface Props {
    follow?: boolean;
    verticalScrollbar?: number;
    hasContent?: boolean;
    bottomInset?: number;
    onScroll?: ((top: number) => void) | null;
    onNearTop?: (() => void) | null;
    onMove?: (() => void) | null;
    children: Snippet;
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
  }: Props = $props();

  const AT_BOTTOM_PX = 4;
  const OWN_TOP_PX = 1;
  const SCROLL_BUTTON_GAP = 12;
  const HALF = 2;

  let container = $state<HTMLDivElement | null>(null);
  let content = $state<HTMLDivElement | null>(null);
  let belowFold = $state(0);
  let viewport = $state(0);
  let horizontalScrollbar = $state(0);
  let ownTop = -1;
  let pendingTop: number | null = null;

  let pinned: HTMLElement | null = null;
  let stuck: HTMLElement | null = null;

  provideStickyHeads(true);

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
    let row: HTMLElement | null = null;
    let block: HTMLElement | null = null;
    for (let node = edge === undefined ? null : firstVisible(); node; node = node.nextElementSibling as HTMLElement | null) {
      const candidate = node.querySelector<HTMLElement>("[data-block]");
      if (!candidate) continue;
      if (candidate.getBoundingClientRect().top - (edge ?? 0) >= 0) break;
      if (!candidate.querySelector("[data-block-body]")) continue;
      row = node;
      block = candidate;
    }
    pinned = row;
    const head = block?.querySelector<HTMLElement>(":scope > [data-block-head]") ?? null;
    if (head === stuck) return;
    stuck?.removeAttribute("data-stuck");
    head?.setAttribute("data-stuck", "");
    stuck = head;
  };

  export const refreshHeader = () => updatePinned();

  export const collapsePinned = async (id: number, collapse: () => void) => {
    if (pinned?.dataset.mid !== String(id)) return false;
    collapse();
    await tick();
    const node = find(`[data-mid="${id}"]`);
    const block = node?.querySelector<HTMLElement>("[data-block]") ?? node;
    if (block) bringToTop(block);
    updatePinned();
    return true;
  };

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
    style="--scrollbar-width: {verticalScrollbar}px"
    class="selectable rounded-viewport isolate flex h-full flex-col overflow-x-hidden overflow-y-auto"
  >
    <div bind:this={content} class="shrink-0">
      {@render children()}
    </div>
  </div>

  {#if !follow && hasContent && viewport > 0 && belowFold > viewport / HALF}
    <button
      type="button"
      use:keepFocus
      onclick={scrollToEnd}
      title={t("SCROLL_TO_BOTTOM")}
      aria-label={t("SCROLL_TO_BOTTOM")}
      style="bottom: {SCROLL_BUTTON_GAP + horizontalScrollbar + bottomInset}px; right: {SCROLL_BUTTON_GAP +
        verticalScrollbar}px"
      class="absolute inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-float text-on-surface-variant shadow-float transition-colors hover:text-on-surface"
    >
      <ChevronsDown size={18} />
    </button>
  {/if}
</div>
