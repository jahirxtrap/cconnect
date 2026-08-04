<script lang="ts">
  import type { ChatMessage } from "$lib/data/chatModels";
  import MessageItem from "./blocks/MessageItem.svelte";

  interface Props {
    messages: ChatMessage[];
    pendingToolIds: string[];
    onAnswer: (requestId: string, optionId: string) => void;
  }

  const { messages, pendingToolIds, onAnswer }: Props = $props();

  const NEAR_BOTTOM_PX = 80;

  let container = $state<HTMLDivElement | null>(null);
  let follow = $state(true);

  const onscroll = () => {
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    follow = distance < NEAR_BOTTOM_PX;
  };

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (follow && container) container.scrollTop = container.scrollHeight;
  });
</script>

<div bind:this={container} {onscroll} class="h-full overflow-y-auto">
  {#each messages as item, index (item.id)}
    <MessageItem
      message={item}
      prevRole={messages[index - 1]?.role ?? null}
      nextRole={messages[index + 1]?.role ?? null}
      running={!!item.toolUseId && pendingToolIds.includes(item.toolUseId)}
      {onAnswer}
    />
  {/each}
</div>
