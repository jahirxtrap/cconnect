<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import { tick } from "svelte";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
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
    questions: import("svelte").Snippet<[InteractionData]>;
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
    questions,
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
    item.role === "thinking"
      ? index === visible.length - 1 && streaming
      : !!item.toolUseId && pendingToolIds.includes(item.toolUseId);

  const AT_BOTTOM_PX = 4;
  const LOAD_OLDER_PX = 200;
  const SCROLL_BUTTON_GAP = 12;
  const STICKY_FALLBACK = 40;
  const HALF = 2;

  let horizontalScrollbar = $state(0);
  let verticalScrollbar = $state(0);

  let container = $state<HTMLDivElement | null>(null);
  let follow = $state(true);
  let belowFold = $state(0);
  let viewport = $state(0);
  let anchorHeight: number | null = null;
  let lastTop = 0;
  let programmatic = false;

  const distanceToBottom = () =>
    container ? container.scrollHeight - container.scrollTop - container.clientHeight : 0;

  const scrollTo = (top: number) => {
    if (!container) return;
    programmatic = true;
    container.scrollTop = top;
    lastTop = container.scrollTop;
  };

  const expandedState = $state<Record<number, boolean>>({});

  let stickyHeight = $state(0);
  let sticky = $state<{ message: ChatMessage; gap: number; push: number } | null>(null);

  const firstVisible = (): HTMLElement | null => {
    if (!container) return null;
    const items = container.children;
    let low = 0;
    let high = items.length - 1;
    let found: HTMLElement | null = null;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const node = items[middle] as HTMLElement;
      if (node.offsetTop + node.offsetHeight > container.scrollTop) {
        found = node;
        high = middle - 1;
      } else {
        low = middle + 1;
      }
    }
    return found;
  };

  const updateSticky = () => {
    const node = firstVisible();
    const id = Number(node?.dataset.mid);
    if (!container || !node || !node.dataset.mid || !expandedState[id]) {
      sticky = null;
      return;
    }
    const index = visible.findIndex((item) => item.id === id);
    const message = visible[index];
    if (!message || !hasCollapsibleContent(message, modeFor(message.role) === "label")) {
      sticky = null;
      return;
    }
    const gap = gapAbove(visible[index - 1]?.role ?? null, message.role);
    const top = node.offsetTop - container.scrollTop;
    if (top + gap >= 0) {
      sticky = null;
      return;
    }
    const height = stickyHeight > 0 ? stickyHeight : STICKY_FALLBACK;
    sticky = { message, gap, push: Math.min(0, top + node.offsetHeight - height) };
  };

  const collapseSticky = async () => {
    const current = sticky;
    if (!current || !container) return;
    const node = container.querySelector<HTMLElement>(`[data-mid="${current.message.id}"]`);
    const top = node ? node.offsetTop + current.gap : container.scrollTop;
    expandedState[current.message.id] = false;
    await tick();
    scrollTo(top);
  };

  const measureScrollbar = () => {
    if (!container) return;
    verticalScrollbar = container.offsetWidth - container.clientWidth;
    horizontalScrollbar = container.offsetHeight - container.clientHeight;
  };

  const onscroll = () => {
    if (!container) return;
    measureScrollbar();
    const top = container.scrollTop;
    const manual = !programmatic;
    programmatic = false;
    if (manual && top < lastTop) follow = false;
    lastTop = top;
    belowFold = distanceToBottom();
    viewport = container.clientHeight;
    if (belowFold <= AT_BOTTOM_PX) follow = true;
    updateSticky();
    if (top < LOAD_OLDER_PX) {
      anchorHeight = container.scrollHeight;
      onLoadOlder();
    }
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

  const toBottom = () => {
    if (!container) return;
    follow = true;
    programmatic = true;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  $effect(() => {
    const element = container;
    if (!element) return;
    measureScrollbar();
    const observer = new ResizeObserver(() => {
      measureScrollbar();
      if (follow) scrollTo(element.scrollHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (!container) return;
    measureScrollbar();
    if (anchorHeight !== null && container.scrollHeight > anchorHeight) {
      scrollTo(container.scrollTop + container.scrollHeight - anchorHeight);
      anchorHeight = null;
      return;
    }
    if (follow) scrollTo(container.scrollHeight);
  });

  $effect(() => {
    const last = messages.at(-1);
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    follow = true;
    programmatic = true;
    container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  });

  $effect(() => {
    void visible;
    void stickyHeight;
    updateSticky();
  });

  $effect(() => onFollowChange(follow));
</script>

<svelte:window onkeydown={onKeydown} />

<div class="relative h-full">
  <div bind:this={container} {onscroll} class="selectable h-full overflow-y-auto">
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
          onToggle={() => (expandedState[item.id] = !expandedState[item.id])}
          {onAnswer}
          {onSharedLink}
          {questions}
        />
      </div>
    {/each}
    {#if streamStatus && !(compacting && streamStatus === "slow")}
      <StatusProgress kind={streamStatus === "failed" ? "failed" : "slow"} />
    {/if}
    {#if compacting}
      <StatusProgress kind="compacting" />
    {/if}
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
      style="bottom: {SCROLL_BUTTON_GAP + horizontalScrollbar}px; right: {SCROLL_BUTTON_GAP + verticalScrollbar}px"
      class="absolute inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
    >
      <ChevronsDown size={24} />
    </button>
  {/if}
</div>
