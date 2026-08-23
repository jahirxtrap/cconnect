<script lang="ts">
  import { settledMarkdown } from "$lib/markdown/render";
  import Bell from "@lucide/svelte/icons/bell";
  import Bot from "@lucide/svelte/icons/bot";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderArchive from "@lucide/svelte/icons/folder-archive";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Snippet } from "svelte";
  import type { ChatMessage, InteractionData, Role } from "$lib/data/chatModels";
  import { isArchive } from "$lib/data/format";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { formatClock } from "$lib/data/time";
  import { userContent } from "$lib/data/userContent";
  import Chip from "$lib/ui/Chip.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import AgentBlock from "./AgentBlock.svelte";
  import Collapsible from "./Collapsible.svelte";
  import CompactBlock from "./CompactBlock.svelte";
  import FileChangeBlock from "./FileChangeBlock.svelte";
  import InteractionBlock from "./InteractionBlock.svelte";
  import PlanBlock from "./PlanBlock.svelte";
  import ToolBlock from "./ToolBlock.svelte";
  import { gapAbove, gapBelow } from "./gaps";

  interface Props {
    message: ChatMessage;
    prevRole: Role | null;
    nextRole: Role | null;
    running: boolean;
    gluedTop?: boolean;
    labelMode?: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onAnswer?: (requestId: string, optionId: string) => void;
    onSharedLink?: (url: string, filename: string) => void;
    component?: Snippet<[InteractionData]>;
  }

  const {
    message,
    prevRole,
    nextRole,
    running,
    gluedTop = false,
    labelMode = false,
    expanded = null,
    onToggle = null,
    onAnswer,
    onSharedLink,
    component,
  }: Props = $props();

  const top = $derived(gluedTop ? 0 : gapAbove(prevRole, message.role));
  const bottom = $derived(gapBelow(message.role, nextRole));
</script>

<div class="w-full" style="padding-top: {top}px; padding-bottom: {bottom}px">
  {#if message.role === "user"}
    {@const content = userContent(message)}
    {@const showTime = message.timestamp !== null && settings.showTimestamps}
    <div class="flex w-full flex-col bg-surface-variant px-4 py-3 {content.attachments.length ? 'gap-1.5' : ''}">
      {#if content.body}
        <p class="text-body-md wrap-anywhere whitespace-pre-wrap">{content.body}</p>
      {/if}
      {#if content.attachments.length || showTime || message.sendStatus === "error"}
        <div class="flex w-full items-end">
          {#if content.attachments.length}
            <div
              use:hscrollbar={{ touchIndicator: false }}
              class="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto"
            >
              {#each content.attachments as attachment (attachment.url)}
                <Chip
                  name={attachment.name}
                  icon={isArchive(attachment.name) ? FolderArchive : FileIcon}
                  onclick={() => onSharedLink?.(attachment.url, attachment.name)}
                />
              {/each}
            </div>
          {:else}
            <div class="flex-1"></div>
          {/if}
          {#if showTime}
            <span class="pl-2 text-label-sm text-on-surface-variant select-none">
              {formatClock(message.timestamp ?? 0)}
            </span>
          {/if}
          {#if message.sendStatus === "error"}
            <TriangleAlert size={14} class="ml-1.5 shrink-0 text-error" />
          {/if}
        </div>
      {/if}
    </div>
  {:else if message.role === "assistant"}
    <div class="w-full px-4">
      <MarkdownText text={running ? settledMarkdown(message.text) : message.text} {onSharedLink} />
    </div>
  {:else if message.role === "thinking"}
    <Collapsible
      label={t("THINKING")}
      icon={Lightbulb}
      labelOnly={message.labelOnly || labelMode}
      iconClass="text-on-surface-variant"
      {running}
      {expanded}
      {onToggle}
    >
      <MarkdownText text={message.text} dense class="text-on-surface-variant" />
    </Collapsible>
  {:else if message.role === "working"}
    <Collapsible
      label={t("WORKING")}
      icon={Bot}
      iconClass="text-on-surface-variant"
      labelOnly
      {running}
    />
  {:else if message.role === "tool"}
    <ToolBlock
      name={message.toolName}
      input={message.text}
      result={message.result}
      {running}
      {expanded}
      {onToggle}
    />
  {:else if message.role === "tool_result"}
    <Collapsible label={t("RESULT")} labelOnly={message.labelOnly || labelMode} {expanded} {onToggle}>
      <MarkdownText text={message.text} dense />
    </Collapsible>
  {:else if message.role === "summary"}
    <Collapsible label={t("SUMMARY")} {expanded} {onToggle}>
      <MarkdownText text={message.text} dense />
    </Collapsible>
  {:else if message.role === "plan"}
    <PlanBlock markdown={message.text} {expanded} {onToggle} {onSharedLink} />
  {:else if message.role === "interaction"}
    {#if message.interaction}
      {#if message.interaction.kind === "component" && component}
        {@render component(message.interaction)}
      {:else}
        <InteractionBlock
          data={message.interaction}
          toolName={message.toolName}
          input={message.text}
          {expanded}
          {onToggle}
          onAnswer={onAnswer ?? (() => {})}
        />
      {/if}
    {/if}
  {:else if message.role === "file_change"}
    <FileChangeBlock
      path={message.path ?? ""}
      diffLines={message.diffLines ?? []}
      labelOnly={message.labelOnly || labelMode}
      {expanded}
      {onToggle}
    />
  {:else if message.role === "compact"}
    {#if message.compact}
      <CompactBlock compact={message.compact} {expanded} {onToggle} />
    {/if}
  {:else if message.role === "agent"}
    <AgentBlock {message} {running} {labelMode} {expanded} {onToggle} {onSharedLink} />
  {:else if message.role === "notification"}
    <div class="flex w-full items-center gap-1.5 px-4">
      <Bell size={16} class="shrink-0 text-accent" />
      <p class="line-clamp-2 min-w-0 flex-1 text-label-lg text-accent">
        {t("NOTIFICATION")}
        {#if message.text.trim()}
          <span class="text-on-surface-variant">&nbsp;&nbsp;{message.text}</span>
        {/if}
      </p>
    </div>
  {:else if message.role === "api_error"}
    <div class="flex w-full items-start gap-2 bg-orange/15 px-4 py-3">
      <TriangleAlert size={18} class="mt-px shrink-0 text-orange" />
      <p class="min-w-0 flex-1 text-body-md wrap-anywhere whitespace-pre-wrap text-orange">{message.text}</p>
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
