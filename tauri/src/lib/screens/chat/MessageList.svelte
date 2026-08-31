<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import { tick, untrack } from "svelte";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import { scrollbarWidth } from "$lib/ui/scrollbar";
  import DateSeparator from "./blocks/DateSeparator.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
  import StatusProgress from "./blocks/StatusProgress.svelte";
  import StickyHeader from "./blocks/StickyHeader.svelte";
  import { gapAbove } from "./blocks/gaps";
  import { hasCollapsibleContent } from "./blocks/sticky";

  interface Visibility {
    thinking: string;
    toolUse: string;
    fileChange: string;
    compact: string;
  }

  interface Props {
    messages: ChatMessage[];
    pendingToolIds: string[];
    streaming: boolean;
    compacting: boolean;
    streamStatus: string | null;
    visibility: Visibility;
    onAnswer: (requestId: string, optionId: string) => void;
    onLoadOlder: () => void;
    onFollowChange: (following: boolean) => void;
    onSharedLink: (url: string, filename: string) => void;
    tabId: string;
    savedScroll: { top: number; follow: boolean };
    onScrollTop: (top: number, following: boolean) => void;
    component: import("svelte").Snippet<[InteractionData, (grow: () => void, anchor: HTMLElement | null) => void]>;
    bottomInset?: number;
  }

  const {
    messages,
    pendingToolIds,
    streaming,
    compacting,
    streamStatus,
    visibility,
    onAnswer,
    onLoadOlder,
    onFollowChange,
    onSharedLink,
    tabId,
    savedScroll,
    onScrollTop,
    component,
    bottomInset = 0,
  }: Props = $props();

  const modeFor = (role: ChatMessage["role"]) =>
    role === "thinking"
      ? visibility.thinking
      : role === "tool" || role === "tool_result" || role === "agent"
        ? visibility.toolUse
        : role === "file_change"
          ? visibility.fileChange
          : role === "compact"
            ? visibility.compact
            : "full";

  const visible = $derived(messages.filter((item) => modeFor(item.role) !== "off"));

  const runningAt = (item: ChatMessage, index: number) =>
    item.role === "thinking" || item.role === "working" || item.role === "assistant"
      ? index === visible.length - 1 && streaming
      : !!item.toolUseId && pendingToolIds.includes(item.toolUseId);

  const AT_BOTTOM_PX = 4;
  const SETTLE_MS = 120;
  const OWN_TOP_PX = 1;
  const LOAD_OLDER_PX = 200;
  const SCROLL_END = "onscrollend" in window;
  const SCROLL_BUTTON_GAP = 12;
  const STICKY_FALLBACK = 40;
  const HALF = 2;

  let horizontalScrollbar = $state(0);
  let verticalScrollbar = $state(0);

  let container = $state<HTMLDivElement | null>(null);
  let content = $state<HTMLDivElement | null>(null);
  let follow = $state(true);
  let restoredTab: string | null = null;
  let belowFold = $state(0);
  let viewport = $state(0);
  let ownTop = -1;
  let lastTop = 0;
  let smooth = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastId: number | null = null;

  let scrollSign = 0;
  let carry = 0;

  const detectScrollSign = () => {
    if (!container || container.scrollHeight <= container.clientHeight) return;
    const previous = container.scrollTop;
    container.scrollTop = -1;
    scrollSign = container.scrollTop < 0 ? -1 : 1;
    container.scrollTop = previous;
  };

  const distanceToBottom = () => (container ? Math.abs(container.scrollTop) : 0);

  const atBottom = () =>
    !container || container.scrollHeight <= container.clientHeight || distanceToBottom() <= AT_BOTTOM_PX;

  const distanceToTop = () =>
    container ? container.scrollHeight - container.clientHeight - Math.abs(container.scrollTop) : 0;

  const scrollTo = (top: number) => {
    if (!container) return;
    if (!scrollSign) detectScrollSign();
    container.scrollTop = (scrollSign || -1) * Math.abs(top);
    ownTop = container.scrollTop;
    lastTop = container.scrollTop;
  };

  const scrollFromTop = (fromTop: number) => {
    if (!container) return;
    const max = container.scrollHeight - container.clientHeight;
    scrollTo(Math.max(0, max - fromTop));
  };

  const smoothToEnd = () => {
    if (!container) return;
    smooth = true;
    container.scrollTo({ top: 0, behavior: "smooth" });
  };

  const settle = () => {
    settleTimer = null;
    smooth = false;
    if (distanceToBottom() <= AT_BOTTOM_PX) follow = true;
  };

  const expandedState = $state<Record<number, boolean>>({});

  let stickyHeight = $state(0);
  let sticky = $state<{ message: ChatMessage; gap: number; push: number } | null>(null);

  const topOf = (node: HTMLElement) => node.offsetTop - (content?.offsetTop ?? 0);

  const firstVisible = (): HTMLElement | null => {
    if (!container || !content) return null;
    const items = content.children;
    let low = 0;
    let high = items.length - 1;
    let found: HTMLElement | null = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const node = items[middle] as HTMLElement;
      if (topOf(node) + node.offsetHeight > distanceToTop()) {
        found = node;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return found;
  };

  const updateSticky = () => {
    if (!container || !content) {
      sticky = null;
      return;
    }
    const start = firstVisible();
    if (!start) {
      sticky = null;
      return;
    }
    let candidate: { message: ChatMessage; gap: number; push: number } | null = null;
    let node: HTMLElement | null = start;
    while (node) {
      const id = Number(node.dataset.mid);
      const index = node.dataset.mid ? visible.findIndex((item) => item.id === id) : -1;
      const message = index >= 0 ? visible[index] : null;
      const gap = message ? gapAbove(visible[index - 1]?.role ?? null, message.role) : 0;
      const top = topOf(node) - distanceToTop();
      if (top + gap >= 0) break;
      if (message && expandedState[id] && hasCollapsibleContent(message, modeFor(message.role) === "label")) {
        const height = stickyHeight > 0 ? stickyHeight : STICKY_FALLBACK;
        candidate = { message, gap, push: Math.min(0, top + node.offsetHeight - height) };
      }
      node = node.nextElementSibling as HTMLElement | null;
    }
    sticky = candidate;
  };

  const collapseSticky = async () => {
    const current = sticky;
    if (!current || !container) return;
    follow = false;
    expandedState[current.message.id] = false;
    await tick();
    const node = container.querySelector<HTMLElement>(`[data-mid="${current.message.id}"]`);
    if (node) scrollFromTop(topOf(node) + current.gap);
    updateSticky();
  };

  const shiftBy = (delta: number) => {
    if (!container) return;
    const wanted = delta + carry;
    if (!wanted) return;
    if (!scrollSign) detectScrollSign();
    const previous = container.scrollTop;
    container.scrollTop += -(scrollSign || -1) * wanted;
    carry = wanted + (scrollSign || -1) * (container.scrollTop - previous);
    ownTop = container.scrollTop;
    lastTop = container.scrollTop;
  };

  const anchorGrowth = async (node: HTMLElement | null, grow: () => void) => {
    if (follow || atBottom()) {
      follow = true;
      grow();
      return;
    }
    if (!node || !container) {
      grow();
      return;
    }
    container.style.overflowAnchor = "none";
    const previousTop = node.getBoundingClientRect().top;
    const hold = () => shiftBy(node.getBoundingClientRect().top - previousTop);
    const observer = new ResizeObserver(hold);
    if (content) observer.observe(content);
    grow();
    await tick();
    hold();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        observer.disconnect();
        if (container) container.style.overflowAnchor = "";
      }),
    );
  };

  const toggleExpanded = (id: number) =>
    anchorGrowth(container?.querySelector<HTMLElement>(`[data-mid="${id}"]`) ?? null, () => {
      expandedState[id] = !expandedState[id];
    });

  const measureScrollbar = () => {
    if (!container) return;
    verticalScrollbar = scrollbarWidth(container);
    horizontalScrollbar = container.offsetHeight - container.clientHeight;
  };

  const onscroll = () => {
    if (!container) return;
    measureScrollbar();
    const top = container.scrollTop;
    const movedUp = Math.abs(top) > Math.abs(lastTop) + OWN_TOP_PX;
    lastTop = top;
    onScrollTop(top, follow);
    belowFold = distanceToBottom();
    viewport = container.clientHeight;
    const ours = smooth || Math.abs(top - ownTop) <= OWN_TOP_PX;
    ownTop = -1;
    if (!ours) carry = 0;
    if (!ours && movedUp && belowFold > AT_BOTTOM_PX) follow = false;
    if (!SCROLL_END) {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SETTLE_MS);
    }
    updateSticky();
    if (distanceToTop() < LOAD_OLDER_PX) onLoadOlder();
  };

  const separatorAt = (index: number) => {
    if (!settings.showTimestamps) return false;
    const current = visible[index].timestamp;
    if (current === null) return false;
    for (let i = index - 1; i >= 0; i--) {
      const previous = visible[i].timestamp;
      if (previous !== null) return dayIndex(previous) !== dayIndex(current);
    }
    return true;
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") return;
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
    if (!container) return;
    event.preventDefault();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const stopFollowing = () => {
    follow = false;
  };

  const onwheel = (event: WheelEvent) => {
    if (event.deltaY < 0) stopFollowing();
  };

  const toBottom = () => {
    follow = true;
    smoothToEnd();
  };

  $effect(() => {
    const element = container;
    const inner = content;
    if (!element || !inner) return;
    measureScrollbar();
    const observer = new ResizeObserver(() => {
      measureScrollbar();
      if (follow) scrollTo(0);
      belowFold = distanceToBottom();
      viewport = element.clientHeight;
      updateSticky();
    });
    observer.observe(element);
    observer.observe(inner);
    return () => observer.disconnect();
  });

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    void compacting;
    void streamStatus;
    if (!container) return;
    measureScrollbar();
    if (follow) scrollTo(0);
  });

  $effect(() => {
    const last = messages.at(-1);
    const id = last?.id ?? null;
    if (id === lastId) return;
    lastId = id;
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    follow = true;
    smoothToEnd();
  });

  $effect(() => {
    void visible;
    void stickyHeight;
    updateSticky();
  });

  $effect(() => onFollowChange(follow));

  $effect(() => {
    const id = tabId;
    if (id === restoredTab) return;
    restoredTab = id;
    const target = untrack(() => savedScroll);
    follow = target.follow;
    void tick().then(() => {
      if (!container) return;
      detectScrollSign();
      scrollTo(target.follow ? 0 : target.top);
    });
  });

  $effect(() => () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="relative h-full">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={container}
    {onscroll}
    {onwheel}
    onscrollend={settle}
    ontouchmove={stopFollowing}
    class="selectable flex h-full flex-col-reverse overflow-x-hidden overflow-y-auto"
  >
    <div bind:this={content} class="mb-auto shrink-0">
    {#each visible as item, index (item.id)}
      {@const separated = separatorAt(index)}
      <div data-mid={item.id}>
        {#if separated}
          <DateSeparator millis={item.timestamp ?? 0} />
        {/if}
        <MessageItem
          message={item}
          prevRole={visible[index - 1]?.role ?? null}
          nextRole={visible[index + 1]?.role ?? null}
          running={runningAt(item, index)}
          gluedTop={separated}
          labelMode={modeFor(item.role) === "label"}
          expanded={expandedState[item.id] ?? false}
          onToggle={() => toggleExpanded(item.id)}
          onGrow={(grow, node) => anchorGrowth(node, grow)}
          {onAnswer}
          {onSharedLink}
          {component}
        />
      </div>
    {/each}
      {#if compacting}
        <StatusProgress kind="compacting" />
      {:else if streamStatus === "slow" || streamStatus === "failed"}
        <StatusProgress kind={streamStatus === "failed" ? "failed" : "slow"} />
      {/if}
    </div>
  </div>

  {#if sticky}
    <div
      bind:clientHeight={stickyHeight}
      style="transform: translateY({sticky.push}px); right: {verticalScrollbar}px"
      class="absolute top-0 left-0 z-10"
    >
      <StickyHeader message={sticky.message} onCollapse={collapseSticky} />
    </div>
  {/if}

  {#if !follow && visible.length && viewport > 0 && belowFold > viewport / HALF}
    <button
      type="button"
      onclick={toBottom}
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
