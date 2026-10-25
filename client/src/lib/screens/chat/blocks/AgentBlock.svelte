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
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onSharedLink?: (url: string, filename: string) => void;
  }

  const {
    message,
    running,
    expanded = null,
    onToggle = null,
    onSharedLink,
  }: Props = $props();

  const keyed = (prefix: string, value: string, fallback: string) => {
    const key = `${prefix}${value.toUpperCase().replace(/-/g, "_")}`;
    const label = t(key);
    return label === key ? fallback : label;
  };

  const stat = $derived.by(() => {
    const done = message.agentResult;
    return (
      joined(
        message.agentRun?.model,
        message.agentRun?.effort,
        done?.status && done.status !== "completed" && keyed("AGENT_", done.status, done.status.replace(/_/g, " ")),
        done && done.durationMs !== null && formatDuration(done.durationMs),
        done && done.tokens !== null && formatTokens(done.tokens),
      ) || null
    );
  });
</script>

<Collapsible
  label={message.toolName ? keyed("AGENT_TYPE_", message.toolName, message.toolName) : t("AGENT")}
  icon={Bot}
  preview={message.text}
  {stat}
  labelOnly={!message.children.length}
  {running}
  {expanded}
  {onToggle}
>
  <div class="flex flex-col">
    {#each message.children as child, index (child.id)}
      <MessageItem
        message={child}
        prevRole={message.children[index - 1]?.role ?? null}
        nextRole={message.children[index + 1]?.role ?? null}
        running={running && index === message.children.length - 1 && (child.role === "thinking" || (child.role === "tool" && child.result === null))}
        nested
        {onSharedLink}
      />
    {/each}
  </div>
</Collapsible>
