<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import Bot from "@lucide/svelte/icons/bot";
  import Inbox from "@lucide/svelte/icons/inbox";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Snippet } from "svelte";
  import type { ChatMessage, InteractionData, Role } from "$lib/data/chatModels";
  import { formatTokens } from "$lib/data/format";
  import { fileIcon } from "$lib/ui/fileIcons";
  import type { IconSource } from "$lib/ui/icons";
  import { settings } from "$lib/data/settings.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { formatClock } from "$lib/data/time";
  import { userContent } from "$lib/data/userContent";
  import type { SuggestionItem } from "$lib/markdown/cconnectBlock";
  import Chip from "$lib/ui/Chip.svelte";
  import ModInline from "$lib/screens/mods/ModInline.svelte";
  import type { ModSurface } from "$lib/screens/mods/modSurface.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import AgentBlock from "./AgentBlock.svelte";
  import Collapsible from "./Collapsible.svelte";
  import CompactBlock from "./CompactBlock.svelte";
  import SharedBlock from "./SharedBlock.svelte";
  import FileChangeBlock from "./FileChangeBlock.svelte";
  import InteractionBlock from "./InteractionBlock.svelte";
  import PlanBlock from "./PlanBlock.svelte";
  import ToolBlock from "./ToolBlock.svelte";
  import { gapAbove, gapBelow, NO_GAP } from "./gaps";

  interface Props {
    message: ChatMessage;
    prevRole: Role | null;
    nextRole: Role | null;
    running: boolean;
    gluedTop?: boolean;
    labelMode?: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onGrow?: (grow: () => void, anchor: HTMLElement | null) => void;
    onAnswer?: (requestId: string, optionId: string) => void;
    onSharedLink?: (url: string, filename: string) => void;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    onSuggest?: ((item: SuggestionItem) => void) | null;
    component?: Snippet<[InteractionData, (grow: () => void, anchor: HTMLElement | null) => void]>;
    mods?: ModSurface | null;
  }

  const SPINNER_ID = "spinner";

  const {
    message,
    prevRole,
    nextRole,
    running,
    gluedTop = false,
    labelMode = false,
    expanded = null,
    onToggle = null,
    onGrow = (grow) => grow(),
    onAnswer,
    onSharedLink,
    onSharedMenu = null,
    onSuggest = null,
    component,
    mods = null,
  }: Props = $props();

  const rowId = $derived(String(message.id));
  const spinnerProps = $derived({ word: t("WORKING"), message: null, suffix: "", mode: running ? "requesting" : "responding" });
  const top = $derived(gluedTop ? NO_GAP : gapAbove(prevRole, message.role));
  const bottom = $derived(gapBelow(message.role, nextRole));
</script>

{#snippet working(props: Record<string, unknown>)}
  <Collapsible
    label={`${typeof props.message === "string" && props.message ? props.message : typeof props.word === "string" ? props.word : t("WORKING")}${typeof props.suffix === "string" ? props.suffix : ""}`}
    icon={Bot}
    iconClass="text-on-surface-variant"
    labelOnly
    {running}
  />
{/snippet}

{#snippet userRow(props: Record<string, unknown>)}
  {@const content = userContent(message)}
  {@const body = typeof props.text === "string" ? props.text : content.body}
  {@const showTime = message.timestamp !== null && settings.showTimestamps}
  <div class="flex w-full flex-col bg-surface-variant px-4 py-3 {content.attachments.length ? 'chat-gap' : ''}">
    {#if body}
      <p class="text-body-md wrap-anywhere whitespace-pre-wrap">{body}</p>
    {/if}
    {#if content.attachments.length || showTime || message.sendStatus === "error"}
      <div class="flex w-full items-end">
        {#if content.attachments.length}
          <div use:hscrollbar class="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
            {#each content.attachments as attachment (attachment.url)}
              <Chip
                name={attachment.name}
                icon={fileIcon(attachment.name)}
                onclick={() => onSharedLink?.(attachment.url, attachment.name)}
                onmenu={onSharedMenu ? () => onSharedMenu(attachment.url, attachment.name) : null}
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
{/snippet}

{#snippet assistantRow(props: Record<string, unknown>)}
  <div class="w-full px-4">
    <MarkdownText
      text={typeof props.text === "string" ? props.text : message.text}
      {onSharedLink}
      {onSharedMenu}
      {onSuggest}
    />
  </div>
{/snippet}

{#snippet toolRow(props: Record<string, unknown>)}
  <ToolBlock
    name={typeof props.tool === "string" ? props.tool : message.toolName}
    input={typeof props.input === "string" ? props.input : message.text}
    result={typeof props.output === "string" ? props.output : message.result}
    took={message.toolMs}
    {running}
    {expanded}
    {onToggle}
    resultView={toolResult}
  />
{/snippet}

{#snippet toolResult(output: string)}
  {@const props = {
    tool_use_id: message.toolUseId ?? rowId,
    tool: message.toolName ?? "",
    output,
    isErrored: false,
    isExpanded: true,
  }}
  {#if mods?.state.surface}
    <ModInline {mods} component="ToolResult" instanceId={rowId} {props} engine={resultCode} />
  {:else}
    {@render resultCode(props)}
  {/if}
{/snippet}

{#snippet resultCode(props: Record<string, unknown>)}
  <CodeBlock code={typeof props.output === "string" ? props.output : (message.result ?? "")} lang={t("RESULT")} />
{/snippet}

{#snippet resultText(props: Record<string, unknown>)}
  <MarkdownText text={typeof props.output === "string" ? props.output : message.text} dense />
{/snippet}

{#snippet dialogRow()}
  {#if message.interaction && component}
    {@render component(message.interaction, onGrow)}
  {/if}
{/snippet}

{#snippet line(Icon: IconSource, label: string, tone: string)}
  {@const body = message.text.trim()}
  <div class="flex w-full items-center gap-1.5 px-4 select-none">
    <Icon size={16} class="shrink-0 {tone}" />
    <p class="line-clamp-2 min-w-0 flex-1 text-label-lg {body ? 'text-on-surface-variant' : tone}">
      <span class={body ? tone : ""}>{label}</span>
      {#if body}&nbsp;&nbsp;{body}{/if}
    </p>
  </div>
{/snippet}

<div class="w-full" style="padding-top: {top}; padding-bottom: {bottom}">
  {#if message.role === "user"}
    {@const props = { text: userContent(message).body, origin: { kind: "composer" }, isExpanded: false }}
    {#if mods?.state.surface}
      <ModInline {mods} component="UserMessage" instanceId={rowId} {props} engine={userRow} inset />
    {:else}
      {@render userRow(props)}
    {/if}
  {:else if message.role === "assistant"}
    {@const props = message.ephemeral
      ? { command: "", args: "", text: message.text, isErrored: false }
      : { text: message.text, isFirstOfReply: prevRole !== "assistant" }}
    {@const site = message.ephemeral ? "CommandOutput" : "AssistantMessage"}
    {#if mods?.state.surface}
      <ModInline {mods} component={site} instanceId={rowId} {props} engine={assistantRow} inset />
    {:else}
      {@render assistantRow(props)}
    {/if}
  {:else if message.role === "thinking"}
    <Collapsible
      label={t("THINKING")}
      icon={Lightbulb}
      stat={message.thinkingTokens !== null
        ? plural("TOKENS_COUNT", message.thinkingTokens, formatTokens(message.thinkingTokens))
        : null}
      labelOnly={message.labelOnly || labelMode}
      iconClass="text-on-surface-variant"
      {running}
      {expanded}
      {onToggle}
    >
      <MarkdownText text={message.text} dense class="text-on-surface-variant" />
    </Collapsible>
  {:else if message.role === "working"}
    {#if mods?.state.surface}
      <ModInline {mods} component="Spinner" instanceId={SPINNER_ID} props={spinnerProps} engine={working} />
    {:else}
      {@render working(spinnerProps)}
    {/if}
  {:else if message.role === "tool"}
    {@const props = {
      tool_use_id: message.toolUseId ?? rowId,
      tool: message.toolName ?? "",
      input: message.text,
      isRunning: running,
      isErrored: false,
      isInterrupted: false,
      isExpanded: !!expanded,
      output: message.result,
    }}
    {#if mods?.state.surface}
      <ModInline {mods} component="ToolUse" instanceId={rowId} {props} engine={toolRow} inset />
    {:else}
      {@render toolRow(props)}
    {/if}
  {:else if message.role === "tool_result"}
    {@const props = {
      tool_use_id: message.toolUseId ?? rowId,
      tool: message.toolName ?? "",
      output: message.text,
      isErrored: false,
      isExpanded: !!expanded,
    }}
    <Collapsible label={t("RESULT")} labelOnly={message.labelOnly || labelMode} {expanded} {onToggle}>
      {#if mods?.state.surface}
        <ModInline {mods} component="ToolResult" instanceId={rowId} {props} engine={resultText} />
      {:else}
        {@render resultText(props)}
      {/if}
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
        {#if mods && message.interaction.mod}
          <ModInline
            {mods}
            component="AskUserQuestion"
            instanceId={message.interaction.mod.instanceId}
            props={message.interaction.mod.props}
            engine={dialogRow}
            eager
            inset
          />
        {:else}
          {@render component(message.interaction, onGrow)}
        {/if}
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
  {:else if message.role === "shared"}
    <SharedBlock files={message.files ?? []} {onSharedLink} {onSharedMenu} {expanded} {onToggle} />
  {:else if message.role === "compact"}
    {#if message.compact}
      <CompactBlock compact={message.compact} {expanded} {onToggle} />
    {/if}
  {:else if message.role === "agent"}
    <AgentBlock {message} {running} {labelMode} {expanded} {onToggle} {onSharedLink} />
  {:else if message.role === "agent_report"}
    <Collapsible
      label={message.toolName || t("AGENT_REPORT")}
      icon={Bot}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
      labelClass="text-accent"
    >
      <MarkdownText text={message.text} dense {onSharedLink} {onSharedMenu} />
    </Collapsible>
  {:else if message.role === "session_message" || message.role === "plugin_message"}
    {@const fromPlugin = message.role === "plugin_message"}
    <Collapsible
      label={message.toolName || t(fromPlugin ? "PLUGIN_MESSAGE" : "SESSION_MESSAGE")}
      icon={fromPlugin ? Puzzle : Inbox}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
      labelClass="text-accent"
    >
      <MarkdownText text={message.text} dense />
    </Collapsible>
  {:else if message.role === "notification"}
    {@render line(Bell, t("NOTIFICATION"), "text-accent")}
  {:else if message.role === "notice"}
    {@const tone = message.result === "warning" ? "text-orange" : "text-accent"}
    <Collapsible
      label={message.toolName || t("NOTICE")}
      icon={Puzzle}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
      labelClass={tone}
      iconClass={tone}
    >
      <MarkdownText text={message.text} dense />
    </Collapsible>
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
