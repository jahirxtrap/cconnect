<script lang="ts">
  import type { ChatMessage } from "$lib/data/chatModels";
  import { formatDuration, formatTokens, joined } from "$lib/data/format";
  import { t } from "$lib/i18n/index.svelte";
  import { agents } from "$lib/services/agents.svelte";
  import { contextServer } from "$lib/services/serverContext";
  import { accountIcon } from "$lib/ui/accountIcon";
  import AgentIcon from "$lib/screens/agents/AgentIcon.svelte";
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

  const server = contextServer();

  const account = $derived(message.agentRun?.account ?? null);
  const delegated = $derived(!!account || !!message.agentRun?.agent);
  const logo = $derived(agents.iconOf(server(), message.agentRun?.agent ?? null));

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

{#snippet agentLogo(glyph: string)}
  <AgentIcon url={logo} class={glyph} />
{/snippet}

<Collapsible
  label={message.toolName
    ? delegated
      ? message.toolName
      : keyed("AGENT_TYPE_", message.toolName, message.toolName)
    : t("AGENT")}
  icon={account ? accountIcon(account.provider) : undefined}
  leading={account ? undefined : agentLogo}
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
