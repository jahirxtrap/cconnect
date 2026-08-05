<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { ChatMessage, InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import DateSeparator from "./blocks/DateSeparator.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
  import StatusProgress from "./blocks/StatusProgress.svelte";

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

  const NEAR_BOTTOM_PX = 80;
  const LOAD_OLDER_PX = 200;
  const SCROLL_BUTTON_GAP = 12;

  let horizontalScrollbar = $state(0);
  let verticalScrollbar = $state(0);

  let container = $state<HTMLDivElement | null>(null);
  let follow = $state(true);
  let anchorHeight: number | null = null;

  const measureScrollbar = () => {
    if (!container) return;
    verticalScrollbar = container.offsetWidth - container.clientWidth;
    horizontalScrollbar = container.offsetHeight - container.clientHeight;
  };

  const onscroll = () => {
    if (!container) return;
    measureScrollbar();
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    follow = distance < NEAR_BOTTOM_PX;
    if (container.scrollTop < LOAD_OLDER_PX) {
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
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  $effect(() => {
    const element = container;
    if (!element) return;
    measureScrollbar();
    const observer = new ResizeObserver(() => {
      measureScrollbar();
      if (follow) element.scrollTop = element.scrollHeight;
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
      container.scrollTop += container.scrollHeight - anchorHeight;
      anchorHeight = null;
      return;
    }
    if (follow) container.scrollTop = container.scrollHeight;
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="relative h-full">
  <div bind:this={container} {onscroll} class="selectable h-full overflow-y-auto">
    {#each visible as item, index (item.id)}
      {@const separated = separatorAt(index)}
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
        {onAnswer}
        {onSharedLink}
        {questions}
      />
    {/each}
    {#if streamStatus && !(compacting && streamStatus === "slow")}
      <StatusProgress kind={streamStatus === "failed" ? "failed" : "slow"} />
    {/if}
    {#if compacting}
      <StatusProgress kind="compacting" />
    {/if}
  </div>

  {#if !follow && visible.length}
    <button
      type="button"
      onclick={toBottom}
      title={t("SCROLL_TO_BOTTOM")}
      aria-label={t("SCROLL_TO_BOTTOM")}
      style="bottom: {SCROLL_BUTTON_GAP + horizontalScrollbar}px; right: {SCROLL_BUTTON_GAP + verticalScrollbar}px"
      class="absolute inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
    >
      <ChevronDown size={24} />
    </button>
  {/if}
</div>
