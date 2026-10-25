<script lang="ts">
  import Bell from "@lucide/svelte/icons/bell";
  import Bot from "@lucide/svelte/icons/bot";
  import Inbox from "@lucide/svelte/icons/inbox";
  import Info from "@lucide/svelte/icons/info";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Puzzle from "@lucide/svelte/icons/puzzle";
  import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import type { Snippet } from "svelte";
  import type { ChatMessage, InteractionData, Role } from "$lib/data/chatModels";
  import { formatTokens } from "$lib/data/format";
  import { fileIcon } from "$lib/ui/fileIcons";
  import { settings } from "$lib/data/settings.svelte";
  import { plural, t } from "$lib/i18n/index.svelte";
  import { formatClock } from "$lib/data/time";
  import { userContent } from "$lib/data/userContent";
  import { elementLabel } from "$lib/data/pickedElements";
  import type { SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { agentFieldsOf, diffLinesOf } from "$lib/services/chatSocket";
  import { contextServer } from "$lib/services/serverContext";
  import Chip from "$lib/ui/Chip.svelte";
  import ModInline from "$lib/screens/mods/ModInline.svelte";
  import UsageWindows from "$lib/screens/claude/UsageWindows.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import type { ModSurface } from "$lib/screens/mods/modSurface.svelte";
  import CodeBlock from "$lib/ui/CodeBlock.svelte";
  import { joinedCorners } from "$lib/ui/joinedCorners";
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { hscrollbar, SCROLL_ROW_CLASS } from "$lib/ui/scrollbar";
  import AgentBlock from "./AgentBlock.svelte";
  import Collapsible from "./Collapsible.svelte";
  import CompactBlock from "./CompactBlock.svelte";
  import SharedBlock from "./SharedBlock.svelte";
  import FileChangeBlock from "./FileChangeBlock.svelte";
  import InteractionBlock from "./InteractionBlock.svelte";
  import NoticeCard from "./NoticeCard.svelte";
  import PlanBlock from "./PlanBlock.svelte";
  import ToolBlock from "./ToolBlock.svelte";
  import { gapAbove, gapBelow, NO_GAP, rowGap, type GapRole } from "./gaps";
  import { rowSite } from "./rowSite";
  import { TINT_CLASS } from "./tint";

  interface Props {
    message: ChatMessage;
    prevRole: Role | null;
    nextRole: GapRole | null;
    running: boolean;
    gluedTop?: boolean;
    spaced?: boolean;
    nested?: boolean;
    labelMode?: boolean;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    onGrow?: (grow: () => void, anchor: HTMLElement | null) => void;
    onAnswer?: (requestId: string, optionId: string) => void;
    onSharedLink?: (url: string, filename: string) => void;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    onSuggest?: SuggestionPicker | null;
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
    spaced = false,
    nested = false,
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

  const server = contextServer();

  const rowId = $derived(String(message.id));
  const spinnerProps = $derived({ word: t("WORKING"), message: null, suffix: "", mode: running ? "requesting" : "responding" });
  const gap = $derived(gapAbove(prevRole, message.role));
  const top = $derived(
    gluedTop || (nested && prevRole === null) ? NO_GAP : rowGap(prevRole, message.role, gap, spaced),
  );
  const bottom = $derived(nested ? NO_GAP : gapBelow(nextRole));
</script>

{#snippet working(props: Record<string, unknown>)}
  <Collapsible
    label={`${typeof props.message === "string" && props.message ? props.message : typeof props.word === "string" ? props.word : t("WORKING")}${typeof props.suffix === "string" ? props.suffix : ""}`}
    icon={Bot}
    labelOnly
    {running}
    tone="quiet"
  />
{/snippet}

{#snippet userRow(props: Record<string, unknown>)}
  {@const content = userContent(message, server())}
  {@const body = typeof props.text === "string" ? props.text : content.body}
  {@const showTime = message.timestamp !== null && settings.showTimestamps}
  {@const chips = content.attachments.length + content.elements.length}
  {@const corners = joinedCorners(prevRole === "user", nextRole === "user", "panel")}
  <div class="w-full px-(--page-inset)">
    <div class="flex w-full min-w-0 flex-col {corners} bg-surface-variant px-3 py-2.5 {chips ? 'chat-gap' : ''}">
      {#if body}
        <p class="text-body-md leading-(--chat-line-body) wrap-anywhere whitespace-pre-wrap">{body}</p>
      {/if}
      {#if chips || showTime || message.sendStatus === "error"}
        <div class="flex w-full items-end">
          {#if chips}
            <div use:hscrollbar class="{SCROLL_ROW_CLASS} flex min-w-0 flex-1 gap-1.5">
              {#each content.elements as element, index (index)}
                <Chip name={elementLabel(element)} icon={SquareMousePointer} />
              {/each}
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
            <span class="pl-2 text-caption text-faint select-none">
              {formatClock(message.timestamp ?? 0)}
            </span>
          {/if}
          {#if message.sendStatus === "error"}
            <TriangleAlert size={14} class="ml-1.5 shrink-0 text-error" />
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet assistantRow(props: Record<string, unknown>)}
  <div class="w-full px-(--page-inset)">
    <MarkdownText
      text={typeof props.text === "string" ? props.text : message.text}
      class="markdown-chat"
      {onSharedLink}
      {onSharedMenu}
      {onSuggest}
    />
  </div>
{/snippet}

{#snippet toolRow(props: Record<string, unknown>)}
  <ToolBlock
    name={typeof props.tool === "string" ? props.tool : message.toolName}
    mcp={message.toolMcp}
    input={typeof props.input === "string" ? props.input : message.text}
    result={typeof props.output === "string" ? props.output : message.result}
    took={message.toolMs}
    {running}
    {expanded}
    {onToggle}
    resultView={toolResult}
  />
{/snippet}

{#snippet fileChangeRow(props: Record<string, unknown>)}
  <FileChangeBlock
    path={typeof props.path === "string" ? props.path : (message.path ?? "")}
    tool={message.toolName}
    diffLines={Array.isArray(props.diff_lines) ? diffLinesOf(props) : (message.diffLines ?? [])}
    labelOnly={message.labelOnly || labelMode}
    {expanded}
    {onToggle}
  />
{/snippet}

{#snippet agentRow(props: Record<string, unknown>)}
  {@const fields = agentFieldsOf(props)}
  <AgentBlock
    message={{
      ...message,
      text: fields.description ?? message.text,
      toolName: fields.subagentType ?? message.toolName,
      agentRun:
        fields.model || fields.effort
          ? { model: fields.model ?? message.agentRun?.model ?? null, effort: fields.effort ?? message.agentRun?.effort ?? null }
          : message.agentRun,
    }}
    {running}
    {expanded}
    {onToggle}
    {onSharedLink}
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

<div class="w-full" style="padding-top: {top}; padding-bottom: {bottom}">
  {#if message.role === "user"}
    {@const props = { text: userContent(message, server()).body, origin: { kind: "composer" }, isExpanded: false }}
    {#if mods?.state.surface}
      <ModInline {mods} component="UserMessage" instanceId={rowId} {props} engine={userRow} inset />
    {:else}
      {@render userRow(props)}
    {/if}
  {:else if message.role === "assistant"}
    {@const props = message.ephemeral
      ? { command: "", args: "", text: message.text, isErrored: false }
      : { text: message.text, isFirstOfReply: prevRole !== "assistant" }}
    {@const site = rowSite(message) ?? "AssistantMessage"}
    {#if mods?.state.surface}
      <ModInline {mods} component={site} instanceId={rowId} {props} engine={assistantRow} inset />
    {:else}
      {@render assistantRow(props)}
    {/if}
  {:else if message.role === "thinking"}
    <Collapsible
      label={t("THINKING")}
      icon={Lightbulb}
      tone="quiet"
      stat={message.thinkingTokens !== null
        ? plural("TOKENS_COUNT", message.thinkingTokens, formatTokens(message.thinkingTokens))
        : null}
      labelOnly={message.labelOnly || labelMode}
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
    {@const props = {
      tool_use_id: message.toolUseId ?? rowId,
      tool: message.toolName ?? "",
      input: { file_path: message.path ?? "" },
      isRunning: running,
      isErrored: false,
      isInterrupted: false,
      isExpanded: !!expanded,
    }}
    {#if mods?.state.surface}
      <ModInline {mods} component="ToolUse" instanceId={rowId} {props} engine={fileChangeRow} inset />
    {:else}
      {@render fileChangeRow(props)}
    {/if}
  {:else if message.role === "shared"}
    <SharedBlock files={message.files ?? []} {onSharedLink} {onSharedMenu} {expanded} {onToggle} />
  {:else if message.role === "compact"}
    {#if message.compact}
      <CompactBlock compact={message.compact} {expanded} {onToggle} />
    {/if}
  {:else if message.role === "agent"}
    {@const props = {
      tool_use_id: message.toolUseId ?? rowId,
      tool: "Agent",
      input: { description: message.text, subagent_type: message.toolName ?? "" },
      isRunning: running,
      isErrored: false,
      isInterrupted: false,
      isExpanded: !!expanded,
    }}
    {#if mods?.state.surface}
      <ModInline {mods} component="ToolUse" instanceId={rowId} {props} engine={agentRow} inset />
    {:else}
      {@render agentRow(props)}
    {/if}
  {:else if message.role === "agent_report"}
    <Collapsible
      label={message.toolName || t("AGENT_REPORT")}
      icon={Bot}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
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
    >
      <MarkdownText text={message.text} dense class={fromPlugin ? "text-on-surface-variant" : ""} />
    </Collapsible>
  {:else if message.role === "usage" && message.usage}
    <div class="w-full px-(--page-inset)">
      <CardPanel>
        {#if message.usage.error !== null || !message.usage.windows.length}
          <p class="text-body-md text-on-surface-variant">{message.usage.error ?? t("NO_USAGE_DATA")}</p>
        {:else}
          <UsageWindows windows={message.usage.windows} />
        {/if}
      </CardPanel>
    </div>
  {:else if message.role === "notification"}
    <Collapsible
      label={t("NOTIFICATION")}
      icon={Bell}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
    >
      <MarkdownText text={message.text} dense class="text-on-surface-variant" />
    </Collapsible>
  {:else if message.role === "notice"}
    {@const warning = message.result === "warning"}
    <Collapsible
      label={message.toolName || t("NOTICE")}
      icon={warning ? TriangleAlert : Puzzle}
      preview={message.text}
      labelOnly={labelMode || !message.text.trim()}
      {expanded}
      {onToggle}
      tone={warning ? "warning" : "process"}
    >
      <MarkdownText text={message.text} dense class="text-on-surface-variant" />
    </Collapsible>
  {:else if message.role === "api_error"}
    {@const warning = message.result === "warning"}
    {@const color = warning ? "text-orange" : "text-red"}
    <div class="w-full px-(--page-inset)">
      <div class="flex items-start gap-2 rounded-panel px-2.5 py-1.5 {TINT_CLASS[warning ? 'orange' : 'red']}">
        <span class="flex h-5 shrink-0 items-center"><TriangleAlert size={14} class={color} /></span>
        <p class="min-w-0 flex-1 text-block wrap-anywhere whitespace-pre-wrap {color}">{message.text}</p>
      </div>
    </div>
  {:else if message.role === "info"}
    {@const [title, ...detail] = message.text.split("\n")}
    <NoticeCard tone="blue" icon={Info} {title} detail={detail.join("\n") || null} />
  {:else if message.role === "interrupted"}
    <div class="w-full px-(--page-inset)">
      <div class="flex h-7 items-center gap-2 rounded-panel px-2.5 {TINT_CLASS.orange}">
        <TriangleAlert size={14} class="shrink-0 text-orange" />
        <p class="min-w-0 flex-1 text-block text-orange">{t("INTERRUPTED")}</p>
      </div>
    </div>
  {:else if message.role === "system"}
    <p class="w-full px-(--page-inset) text-body-sm text-on-surface-variant">{message.text}</p>
  {/if}
</div>
