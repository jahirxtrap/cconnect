<script lang="ts">
  import { tick, untrack } from "svelte";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import type { SuggestionItem } from "$lib/markdown/cconnectBlock";
  import ChatScroller from "./ChatScroller.svelte";
  import DateSeparator from "./blocks/DateSeparator.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
  import StatusProgress from "./blocks/StatusProgress.svelte";
  import StickyHeader from "./blocks/StickyHeader.svelte";

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
    follow?: boolean;
    onSharedLink: (url: string, filename: string) => void;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    onSuggest?: ((item: SuggestionItem) => void) | null;
    sessionId: string | null;
    expandedIds: Record<number, boolean>;
    savedTop: number;
    onScrollTop: (top: number) => void;
    component: import("svelte").Snippet<[InteractionData, (grow: () => void, anchor: HTMLElement | null) => void]>;
    bottomInset?: number;
  }

  let {
    messages,
    pendingToolIds,
    streaming,
    compacting,
    streamStatus,
    visibility,
    onAnswer,
    onLoadOlder,
    follow = $bindable(true),
    onSharedLink,
    onSharedMenu = null,
    onSuggest = null,
    sessionId,
    expandedIds,
    savedTop,
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

  const lastUserAt = $derived(
    visible.reduce((last, item, index) => (item.role === "user" ? index : last), -1),
  );

  const runningAt = (item: ChatMessage, index: number) =>
    item.role === "thinking" || item.role === "working" || item.role === "assistant"
      ? index === visible.length - 1 && streaming
      : !!item.toolUseId && pendingToolIds.includes(item.toolUseId);

  let scroller = $state<ChatScroller | null>(null);
  let lastId: number | null = null;
  let headId: number | null = null;
  let shownSession: string | null = untrack(() => sessionId);
  let heldFromEnd: number | null = null;

  const messageOf = (node: HTMLElement) => visible.find((item) => item.id === Number(node.dataset.mid)) ?? null;

  const collapseSticky = async (id: number) => {
    if (!scroller) return;
    expandedIds[id] = false;
    await tick();
    const node = scroller.find(`[data-mid="${id}"]`);
    const block = node?.querySelector<HTMLElement>("[data-block]") ?? node;
    if (block) scroller.bringToTop(block);
    scroller.refreshHeader();
  };

  const toggleExpanded = (id: number) => {
    if (scroller?.atBottom()) follow = true;
    expandedIds[id] = !expandedIds[id];
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

  $effect.pre(() => {
    const head = messages[0]?.id ?? null;
    const previous = headId;
    headId = head;
    if (previous === null || head === null || head === previous) return;
    heldFromEnd = scroller?.distanceToBottom() ?? null;
  });

  $effect(() => {
    void messages;
    if (heldFromEnd === null) return;
    const distance = heldFromEnd;
    heldFromEnd = null;
    scroller?.scrollFromEnd(distance);
  });

  $effect(() => {
    const id = sessionId;
    if (id === shownSession) return;
    shownSession = id;
    scroller?.scrollToEnd();
  });

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    void compacting;
    void streamStatus;
    if (follow) scroller?.scrollToEnd();
  });

  $effect(() => {
    const last = messages.at(-1);
    const id = last?.id ?? null;
    if (id === lastId) return;
    lastId = id;
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    scroller?.scrollToEnd();
  });

  $effect(() => {
    void visible;
    void expandedIds;
    scroller?.refreshHeader();
  });

  $effect(() => {
    const top = untrack(() => savedTop);
    const following = untrack(() => follow);
    void tick().then(() => {
      if (following) scroller?.scrollToEnd();
      else scroller?.holdAt(top);
    });
  });
</script>

<ChatScroller
  bind:this={scroller}
  bind:follow
  hasContent={visible.length > 0}
  {bottomInset}
  onScroll={onScrollTop}
  onNearTop={onLoadOlder}
>
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
          expanded={expandedIds[item.id] ?? false}
          onToggle={() => toggleExpanded(item.id)}
          {onAnswer}
          {onSharedLink}
          {onSharedMenu}
          onSuggest={index > lastUserAt ? onSuggest : null}
          {component}
        />
      </div>
    {/each}
    {#if compacting}
      <StatusProgress kind="compacting" />
    {:else if streamStatus === "slow" || streamStatus === "failed"}
      <StatusProgress kind={streamStatus === "failed" ? "failed" : "slow"} />
    {/if}
  {#snippet header(node: HTMLElement)}
    {@const message = messageOf(node)}
    {#if message}
      <StickyHeader {message} onCollapse={() => collapseSticky(message.id)} />
    {/if}
  {/snippet}
</ChatScroller>
