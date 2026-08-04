<script lang="ts">
  import type { ChatMessage, InteractionData } from "$lib/data/chatModels";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
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

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (!container) return;
    // Prepending older messages would shift the viewport; keep the read position.
    if (anchorHeight !== null && container.scrollHeight > anchorHeight) {
      container.scrollTop += container.scrollHeight - anchorHeight;
      anchorHeight = null;
      return;
    }
    if (follow) container.scrollTop = container.scrollHeight;
  });
</script>

<div bind:this={container} {onscroll} class="h-full overflow-y-auto">
  {#if loadingOlder}
    <CenteredProgress size={20} class="py-3" />
  {/if}
  {#each messages as item, index (item.id)}
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
