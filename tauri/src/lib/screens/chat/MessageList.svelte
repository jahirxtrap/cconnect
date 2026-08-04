<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { ChatMessage, InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import { t } from "$lib/i18n/index.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import DateSeparator from "./blocks/DateSeparator.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";

  interface Props {
    messages: ChatMessage[];
    pendingToolIds: string[];
    loadingOlder: boolean;
    onAnswer: (requestId: string, optionId: string) => void;
    onLoadOlder: () => void;
    questions: import("svelte").Snippet<[InteractionData]>;
  }

  const { messages, pendingToolIds, loadingOlder, onAnswer, onLoadOlder, questions }: Props = $props();

  const NEAR_BOTTOM_PX = 80;
  const LOAD_OLDER_PX = 200;

  let container = $state<HTMLDivElement | null>(null);
  let follow = $state(true);
  let anchorHeight: number | null = null;

  const onscroll = () => {
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    follow = distance < NEAR_BOTTOM_PX;
    if (container.scrollTop < LOAD_OLDER_PX) {
      anchorHeight = container.scrollHeight;
      onLoadOlder();
    }
  };

  const separatorAt = (index: number) => {
    if (!settings.showTimestamps) return false;
    const current = messages[index].timestamp;
    if (current === null) return false;
    for (let i = index - 1; i >= 0; i--) {
      const previous = messages[i].timestamp;
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
    void messages.at(-1)?.text;
    void messages.length;
    if (!container) return;
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
    {#if loadingOlder}
      <CenteredProgress size={20} class="py-3" />
    {/if}
    {#each messages as item, index (item.id)}
      {#if separatorAt(index)}
        <DateSeparator millis={item.timestamp ?? 0} />
      {/if}
      <MessageItem
        message={item}
        prevRole={messages[index - 1]?.role ?? null}
        nextRole={messages[index + 1]?.role ?? null}
        running={!!item.toolUseId && pendingToolIds.includes(item.toolUseId)}
        {onAnswer}
        {questions}
      />
    {/each}
  </div>

  {#if !follow && messages.length}
    <button
      type="button"
      onclick={toBottom}
      title={t("SCROLL_TO_BOTTOM")}
      aria-label={t("SCROLL_TO_BOTTOM")}
      class="absolute right-3 bottom-3 inline-flex size-10 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
    >
      <ChevronDown size={24} />
    </button>
  {/if}
</div>
