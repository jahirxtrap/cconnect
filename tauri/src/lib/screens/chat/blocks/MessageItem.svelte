<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import Bot from "@lucide/svelte/icons/bot";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { ChatMessage, Role } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { formatClock } from "$lib/data/time";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import AgentBlock from "./AgentBlock.svelte";
  import Collapsible from "./Collapsible.svelte";
  import CompactBlock from "./CompactBlock.svelte";
  import FileChangeBlock from "./FileChangeBlock.svelte";
  import InteractionBlock from "./InteractionBlock.svelte";
  import ToolBlock from "./ToolBlock.svelte";
  import { gapAbove, gapBelow } from "./gaps";

  interface Props {
    message: ChatMessage;
    prevRole: Role | null;
    nextRole: Role | null;
    running: boolean;
    onAnswer?: (requestId: string, optionId: string) => void;
  }

  const { message, prevRole, nextRole, running, onAnswer }: Props = $props();

  const top = $derived(gapAbove(prevRole, message.role));
  const bottom = $derived(gapBelow(message.role, nextRole));
</script>

<div class="w-full" style="padding-top: {top}px; padding-bottom: {bottom}px">
  {#if message.role === "user"}
    <div class="w-full bg-surface-variant px-4 py-3">
      {#if message.text}
        <p class="text-body-md whitespace-pre-wrap">{message.text}</p>
      {/if}
      {#if message.timestamp !== null && settings.showTimestamps}
        <div class="flex items-end justify-end gap-1.5">
          <span class="text-label-md text-on-surface-variant">{formatClock(message.timestamp)}</span>
          {#if message.sendStatus === "error"}
            <TriangleAlert size={14} class="text-error" />
          {/if}
        </div>
      {:else if message.sendStatus === "error"}
        <div class="flex justify-end">
          <TriangleAlert size={14} class="text-error" />
        </div>
      {/if}
    </div>
  {:else if message.role === "assistant"}
    <div class="w-full px-4">
      <MarkdownText text={message.text} />
    </div>
  {:else if message.role === "thinking"}
    <Collapsible label={t("THINKING")} icon={Lightbulb} labelOnly={message.labelOnly} {running}>
      <MarkdownText text={message.text} class="text-on-surface-variant" />
    </Collapsible>
  {:else if message.role === "working"}
    <Collapsible label={t("WORKING")} icon={Bot} labelOnly {running} />
  {:else if message.role === "tool"}
    <ToolBlock name={message.toolName} input={message.text} result={message.result} {running} />
  {:else if message.role === "tool_result"}
    <Collapsible label={t("RESULT")} labelOnly={message.labelOnly}>
      <MarkdownText text={message.text} />
    </Collapsible>
  {:else if message.role === "summary"}
    <Collapsible label={t("SUMMARY")}>
      <MarkdownText text={message.text} />
    </Collapsible>
  {:else if message.role === "plan"}
    <Collapsible label={t("PLAN")} icon={Lightbulb} labelClass="text-accent">
      <MarkdownText text={message.text} />
    </Collapsible>
  {:else if message.role === "interaction"}
    {#if message.interaction}
      <InteractionBlock
        data={message.interaction}
        toolName={message.toolName}
        input={message.text}
        onAnswer={onAnswer ?? (() => {})}
      />
    {/if}
  {:else if message.role === "file_change"}
    <FileChangeBlock path={message.path ?? ""} diffLines={message.diffLines ?? []} labelOnly={message.labelOnly} />
  {:else if message.role === "compact"}
    {#if message.compact}
      <CompactBlock compact={message.compact} />
    {/if}
  {:else if message.role === "agent"}
    <AgentBlock {message} {running} />
  {:else if message.role === "notification"}
    <div class="flex w-full items-center gap-1.5 px-4">
      <Bell size={16} class="shrink-0 text-accent" />
      <p class="min-w-0 flex-1 text-label-lg text-accent">
        {t("NOTIFICATION")}
        {#if message.text.trim()}
          <span class="text-on-surface-variant">&nbsp;&nbsp;{message.text}</span>
        {/if}
      </p>
    </div>
  {:else if message.role === "api_error"}
    <div class="flex w-full items-start gap-2 bg-orange/15 px-4 py-3">
      <TriangleAlert size={18} class="mt-px shrink-0 text-orange" />
      <p class="min-w-0 flex-1 text-body-md whitespace-pre-wrap text-orange">{message.text}</p>
    </div>
  {:else if message.role === "interrupted"}
    <div class="flex w-full items-center gap-2 bg-orange/15 px-4 py-3">
      <TriangleAlert size={18} class="shrink-0 text-orange" />
      <p class="min-w-0 flex-1 text-body-md text-orange">{t("INTERRUPTED")}</p>
    </div>
  {:else if message.role === "system"}
    <p class="w-full px-4 text-body-sm text-on-surface-variant">{message.text}</p>
  {/if}
</div>
