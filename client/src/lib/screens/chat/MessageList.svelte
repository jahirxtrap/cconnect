<script lang="ts">
  import FileSearch from "@lucide/svelte/icons/file-search";
  import { tick, untrack } from "svelte";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { settings } from "$lib/data/settings.svelte";
  import { dayIndex } from "$lib/data/time";
  import type { SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import ModInline from "$lib/screens/mods/ModInline.svelte";
  import type { ModSurface } from "$lib/screens/mods/modSurface.svelte";
  import ChatScroller from "./ChatScroller.svelte";
  import Collapsible from "./blocks/Collapsible.svelte";
  import DateSeparator from "./blocks/DateSeparator.svelte";
  import { cardGap, gapAbove, gapBelow, NO_GAP } from "./blocks/gaps";
  import MessageItem from "./blocks/MessageItem.svelte";
  import { rowSite } from "./blocks/rowSite";
  import StatusProgress from "./blocks/StatusProgress.svelte";
  import { runSummary, toolRuns, type ToolRun } from "./toolRuns";

  interface Visibility {
    thinking: string;
    toolUse: string;
    fileChange: string;
    compact: string;
  }

  interface Props {
    messages: ChatMessage[];
    pendingToolIds: string[];
    streaming: boolean;
    compacting: boolean;
    streamStatus: string | null;
    visibility: Visibility;
    onAnswer: (requestId: string, optionId: string) => void;
    onLoadOlder: () => void;
    follow?: boolean;
    onSharedLink: (url: string, filename: string) => void;
    onSharedMenu?: ((url: string, filename: string) => void) | null;
    onSuggest?: SuggestionPicker | null;
    sessionId: string | null;
    expandedIds: Record<number, boolean>;
    savedTop: number;
    onScrollTop: (top: number) => void;
    component: import("svelte").Snippet<[InteractionData, (grow: () => void, anchor: HTMLElement | null) => void]>;
    bottomInset?: number;
    mods?: ModSurface | null;
  }

  let {
    messages,
    pendingToolIds,
    streaming,
    compacting,
    streamStatus,
    visibility,
    onAnswer,
    onLoadOlder,
    follow = $bindable(true),
    onSharedLink,
    onSharedMenu = null,
    onSuggest = null,
    sessionId,
    expandedIds,
    savedTop,
    onScrollTop,
    component,
    bottomInset = 0,
    mods = null,
  }: Props = $props();

  const modeFor = (role: ChatMessage["role"]) =>
    role === "thinking"
      ? visibility.thinking
      : role === "tool" || role === "tool_result" || role === "agent"
        ? visibility.toolUse
        : role === "file_change"
          ? visibility.fileChange
          : role === "compact"
            ? visibility.compact
            : "full";

  const visible = $derived(messages.filter((item) => modeFor(item.role) !== "off"));

  const lastUserAt = $derived(
    visible.reduce((last, item, index) => (item.role === "user" ? index : last), -1),
  );

  const runningAt = (item: ChatMessage, index: number) =>
    item.role === "thinking" || item.role === "working" || item.role === "assistant"
      ? index === visible.length - 1 && streaming
      : !!item.toolUseId && pendingToolIds.includes(item.toolUseId);

  let openGroups = $state<Record<string, boolean>>({});

  const runs = $derived(mods?.state.surface ? toolRuns(visible) : []);
  const runOf = $derived(new Map(runs.flatMap((run) => run.members.map((id) => [id, run] as const))));

  const runActive = (run: ToolRun) => {
    if (!streaming) return false;
    const last = visible.findIndex((item) => item.id === run.members.at(-1));
    return visible.slice(last + 1).every((item) => item.role === "working" || item.role === "thinking");
  };

  const groupProps = (run: ToolRun) => ({
    calls: run.calls.map((call) => ({
      tool_use_id: call.toolUseId ?? String(call.id),
      tool: call.toolName ?? "",
      input: call.text,
      isRunning: !!call.toolUseId && pendingToolIds.includes(call.toolUseId),
      isErrored: false,
      isInterrupted: false,
      ...(call.result === null || call.result === undefined ? {} : { output: call.result }),
    })),
    isActive: runActive(run),
    isExpanded: true,
    isCallsOnly: true,
  });

  const groupFolded = (run: ToolRun) => mods?.drawing("ToolGroup", run.id)?.props?.isExpanded === false;

  const groupHides = (run: ToolRun, id: number) =>
    id !== run.anchor && (!!mods?.tree("ToolGroup", run.id) || (groupFolded(run) && !openGroups[run.id]));

  const rowTree = (item: ChatMessage | undefined) => {
    const site = item ? rowSite(item) : null;
    return !!item && !!site && !!mods?.tree(site, String(item.id));
  };

  const carded = (item: ChatMessage | undefined) => {
    const run = item ? runOf.get(item.id) : undefined;
    return (!!run && !!mods?.tree("ToolGroup", run.id)) || rowTree(item);
  };

  const spacedAt = (index: number) => {
    const item = visible[index];
    const prev = visible[index - 1];
    const run = runOf.get(item.id);
    const inside = !!run && !!prev && runOf.get(prev.id) === run;
    return inside ? rowTree(item) || rowTree(prev) : carded(item) || carded(prev);
  };

  const groupSpacing = (run: ToolRun, index: number, glued: boolean) => {
    if (!mods?.tree("ToolGroup", run.id) && !groupFolded(run)) return undefined;
    const last = visible.findIndex((item) => item.id === run.members.at(-1));
    const gap = gapAbove(visible[index - 1]?.role ?? null, visible[index].role);
    const top = glued ? NO_GAP : spacedAt(index) ? cardGap(gap) : gap;
    const bottom = gapBelow(visible[last].role, visible[last + 1]?.role ?? null);
    return `padding-top: ${top}; padding-bottom: ${bottom}`;
  };

  const toggleGroup = (id: string) => void anchorGrowth(() => (openGroups[id] = !openGroups[id]));

  let scroller = $state<ChatScroller | null>(null);
  let lastId: number | null = null;
  let headId: number | null = null;
  let shownSession: string | null = untrack(() => sessionId);
  let heldFromEnd: number | null = null;

  const anchorGrowth = async (grow: () => void) => {
    const pinnedToEnd = scroller?.atBottom() ?? false;
    grow();
    if (!pinnedToEnd) return;
    await tick();
    follow = true;
    scroller?.scrollToEnd();
  };

  const toggleExpanded = async (id: number) => {
    if (await scroller?.collapsePinned(id, () => (expandedIds[id] = false))) return;
    void anchorGrowth(() => (expandedIds[id] = !expandedIds[id]));
  };

  const separatorAt = (index: number) => {
    if (!settings.showTimestamps) return false;
    const current = visible[index].timestamp;
    if (current === null) return false;
    for (let i = index - 1; i >= 0; i--) {
      const previous = visible[i].timestamp;
      if (previous !== null) return dayIndex(previous) !== dayIndex(current);
    }
    return true;
  };

  $effect.pre(() => {
    const head = messages[0]?.id ?? null;
    const previous = headId;
    headId = head;
    if (previous === null || head === null || head === previous) return;
    heldFromEnd = scroller?.distanceToBottom() ?? null;
  });

  $effect(() => {
    void messages;
    if (heldFromEnd === null) return;
    const distance = heldFromEnd;
    heldFromEnd = null;
    scroller?.scrollFromEnd(distance);
  });

  $effect(() => {
    const id = sessionId;
    if (id === shownSession) return;
    shownSession = id;
    scroller?.scrollToEnd();
  });

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    void compacting;
    void streamStatus;
    if (follow) scroller?.scrollToEnd();
  });

  $effect(() => {
    const last = messages.at(-1);
    const id = last?.id ?? null;
    if (id === lastId) return;
    lastId = id;
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    scroller?.scrollToEnd();
  });

  $effect(() => {
    void visible;
    void expandedIds;
    scroller?.refreshHeader();
  });

  $effect(() => {
    const top = untrack(() => savedTop);
    const following = untrack(() => follow);
    void tick().then(() => {
      if (following) scroller?.scrollToEnd();
      else scroller?.holdAt(top);
    });
  });
</script>

{#snippet row(item: ChatMessage, index: number, separated: boolean)}
  <MessageItem
    message={item}
    prevRole={visible[index - 1]?.role ?? null}
    nextRole={visible[index + 1]?.role ?? null}
    running={runningAt(item, index)}
    gluedTop={separated}
    spaced={spacedAt(index)}
    labelMode={modeFor(item.role) === "label"}
    expanded={expandedIds[item.id] ?? false}
    onToggle={() => toggleExpanded(item.id)}
    onGrow={anchorGrowth}
    {onAnswer}
    {onSharedLink}
    {onSharedMenu}
    onSuggest={index > lastUserAt ? onSuggest : null}
    {component}
    {mods}
  />
{/snippet}

<ChatScroller
  bind:this={scroller}
  bind:follow
  hasContent={visible.length > 0}
  {bottomInset}
  onScroll={onScrollTop}
  onNearTop={onLoadOlder}
>
    {#each visible as item, index (item.id)}
      {@const run = runOf.get(item.id)}
      {#if !run || !groupHides(run, item.id)}
        {@const separated = separatorAt(index)}
        <div data-mid={item.id}>
          {#if separated}
            <DateSeparator millis={item.timestamp ?? 0} />
          {/if}
          {#if mods && run?.anchor === item.id}
            {#snippet group(shown: Record<string, unknown>)}
              {#if mods?.tree("ToolGroup", run.id)}
                {#each run.members as id (id)}
                  {@const at = visible.findIndex((member) => member.id === id)}
                  {#if at >= 0}
                    {@render row(visible[at], at, at === index && separated)}
                  {/if}
                {/each}
              {:else if shown.isExpanded === false}
                <Collapsible
                  label={runSummary(run)}
                  icon={FileSearch}
                  running={runActive(run)}
                  expanded={!!openGroups[run.id]}
                  onToggle={() => toggleGroup(run.id)}
                />
                {#if openGroups[run.id]}
                  {@render row(item, index, true)}
                {/if}
              {:else}
                {@render row(item, index, separated)}
              {/if}
            {/snippet}
            <div style={groupSpacing(run, index, separated)}>
              <ModInline {mods} component="ToolGroup" instanceId={run.id} props={groupProps(run)} engine={group} inset />
            </div>
          {:else}
            {@render row(item, index, separated)}
          {/if}
        </div>
      {/if}
    {/each}
    {#if compacting}
      <StatusProgress kind="compacting" />
    {:else if streamStatus === "slow" || streamStatus === "failed"}
      <StatusProgress kind={streamStatus === "failed" ? "failed" : "slow"} />
    {/if}
</ChatScroller>
