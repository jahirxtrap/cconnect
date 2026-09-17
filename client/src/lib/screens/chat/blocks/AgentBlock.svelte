<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import type { ChatMessage } from "$lib/data/chatModels";
  import { formatDuration, formatTokens, joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import Collapsible from "./Collapsible.svelte";
  import MessageItem from "./MessageItem.svelte";

  interface Props {
    message: ChatMessage;
    running: boolean;
    labelMode?: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onSharedLink?: (url: string, filename: string) => void;
  }

  const {
    message,
    running,
    labelMode = false,
    expanded = null,
    onToggle = null,
    onSharedLink,
  }: Props = $props();

  const statusLabel = (status: string) => {
    const key = `AGENT_${status.toUpperCase()}`;
    const label = t(key);
    return label === key ? status.replace(/_/g, " ") : label;
  };

  const stat = $derived.by(() => {
    const done = message.agentResult;
    if (!done) return null;
    const parts: string[] = [];
    if (done.status && done.status !== "completed") parts.push(statusLabel(done.status));
    if (done.durationMs !== null) parts.push(formatDuration(done.durationMs));
    if (done.tokens !== null) parts.push(formatTokens(done.tokens));
    return joined(...parts) || null;
  });
</script>

<Collapsible
  label={message.toolName ?? t("AGENT")}
  icon={Bot}
  preview={message.text}
  {stat}
  labelOnly={message.labelOnly || labelMode || !message.children.length}
  {running}
  {expanded}
  {onToggle}
  labelClass="text-accent"
  bodyClass="pt-1 -mx-4 pl-3"
>
  <div class="flex flex-col">
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
