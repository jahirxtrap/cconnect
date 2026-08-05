<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import type { ChatMessage } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import Collapsible from "./Collapsible.svelte";
  import MessageItem from "./MessageItem.svelte";

  interface Props {
    message: ChatMessage;
    running: boolean;
    labelMode?: boolean;
    onSharedLink?: (url: string, filename: string) => void;
  }

  const { message, running, labelMode = false, onSharedLink }: Props = $props();
</script>

<Collapsible
  label={message.toolName ?? t("AGENT")}
  icon={Bot}
  labelOnly={message.labelOnly || labelMode || !message.children.length}
  {running}
  labelClass="text-accent"
>
  <div class="-mx-4 flex flex-col">
    {#if message.text.trim()}
      <p class="px-4 text-body-sm text-on-surface-variant">{message.text}</p>
    {/if}
    {#each message.children as child, index (child.id)}
      <MessageItem
        message={child}
        prevRole={message.children[index - 1]?.role ?? null}
        nextRole={message.children[index + 1]?.role ?? null}
        running={false}
        {onSharedLink}
      />
    {/each}
  </div>
</Collapsible>
