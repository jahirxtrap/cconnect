<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import { QUICK_CHAT_ICON } from "$lib/app/screens";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import type { SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { t } from "$lib/i18n/index.svelte";
  import PanelHandle from "$lib/ui/PanelHandle.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { BlockExpansion } from "./blockExpansion.svelte";
  import ChatScroller from "./ChatScroller.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
  import { CHAT_COLUMN_CLASS } from "./paneChrome";
  import { cubicOut } from "svelte/easing";

  interface Props {
    messages: ChatMessage[];
    streaming: boolean;
    height: number;
    instant?: boolean;
    onHeight: (value: number) => void;
    onDragging: (value: boolean) => void;
    onClear: () => void;
    onClose: () => void;
    onAnswer: (requestId: string, optionId: string) => void;
    component?: import("svelte").Snippet<[InteractionData, (grow: () => void, anchor: HTMLElement | null) => void]>;
    onSuggest?: SuggestionPicker | null;
    bottomInset?: number;
    glass?: boolean;
    underInset?: number;
    column?: boolean;
  }

  const {
    messages,
    streaming,
    height,
    instant = false,
    onHeight,
    onDragging,
    onClear,
    onClose,
    onAnswer,
    component,
    onSuggest = null,
    bottomInset = 0,
    glass = false,
    underInset = 0,
    column = false,
  }: Props = $props();

  const lastUserAt = $derived(messages.findLastIndex((item) => item.role === "user"));

  const PEEK = 58;
  const MIN = 0;
  const MAX = 100;
  const CLOSE_BELOW = 32;
  const FULL_ABOVE = (PEEK + MAX) / 2;
  const PERCENT = 100;

  let panel = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  const onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest("button, a, input, textarea")) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging = true;
    onDragging(true);
    let live = height;
    const box = panel?.parentElement?.clientHeight ?? 0;
    const start = event.clientY;
    const from = height;

    const move = (drag: PointerEvent) => {
      if (box <= 0) return;
      live = Math.min(MAX, Math.max(MIN, from - ((drag.clientY - start) / box) * PERCENT));
      onHeight(live);
    };

    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      dragging = false;
      onDragging(false);
      if (live < CLOSE_BELOW) {
        exitFrom = under;
        onHeight(PEEK);
        onClose();
      } else if (live < FULL_ABOVE) {
        onHeight(PEEK);
      } else {
        onHeight(MAX);
      }
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const toggleFull = () => onHeight(height >= MAX ? PEEK : MAX);

  const corner = $derived(1 - Math.min(1, Math.max(0, (height - PEEK) / (MAX - PEEK))));

  let follow = $state(true);
  let scroller = $state<ChatScroller | null>(null);

  const expansion = new BlockExpansion();

  const grow = (change: () => void) => void scroller?.grow(change);

  let lastPrompt: number | null = null;
  let exitFrom = 0;

  const shown = $derived(Math.min(MAX, Math.max(PEEK, height)));
  const hiddenFraction = $derived(Math.max(0, (PEEK - Math.max(MIN, height)) / PEEK));
  let panelHeight = $state(0);
  const under = $derived(panelHeight > 0 ? (hiddenFraction * panelHeight) / (panelHeight + underInset) : 0);

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (follow) scroller?.scrollToEnd();
  });

  $effect(() => {
    const last = messages.at(-1);
    const id = last?.id ?? null;
    if (id === lastPrompt) return;
    lastPrompt = id;
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    scroller?.scrollToEnd();
  });

  const PANEL_MS = 350;

  const slide = (_node: Element, { duration }: { duration: number }) => {
    const from = exitFrom;
    exitFrom = 0;
    return {
      duration,
      easing: cubicOut,
      css: (progress: number) => `--sheet-under: ${from + (1 - from) * (1 - progress)}`,
    };
  };
</script>

<div
  bind:this={panel}
  bind:clientHeight={panelHeight}
  transition:slide={{ duration: instant ? 0 : PANEL_MS }}
  class="absolute inset-x-0 bottom-0 z-10 flex min-h-0 flex-col {dragging || instant
    ? ''
    : 'transition-[height] duration-[350ms] ease-[cubic-bezier(0.33,1,0.68,1)]'}"
  style="height: {shown}%; --sheet-under: {under}; transform: translateY(calc(var(--sheet-under) * (100% + var(--composer-height, 0px))))"
>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-x-0 top-0 -z-10 shadow-float {glass ? 'glass-panel' : 'bg-background'}"
    style="bottom: calc(var(--composer-height, 0px) * -1); border-top-left-radius: calc(var(--radius-dock) * {corner}); border-top-right-radius: calc(var(--radius-dock) * {corner})"
  ></div>
  <div
    class="relative flex min-h-0 flex-1 flex-col"
    style="clip-path: inset(0 0 calc(var(--sheet-under) * (100% + var(--composer-height, 0px))) 0 round calc(var(--radius-dock) * {corner}) calc(var(--radius-dock) * {corner}) 0 0)"
  >
    {#if shown >= MAX}
      <span class="pointer-events-none absolute inset-x-0 top-0 z-10 border-t border-outline-variant"></span>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      onpointerdown={onPointerDown}
      ondblclick={toggleFull}
      role="separator"
      aria-orientation="horizontal"
      class="shrink-0 cursor-ns-resize touch-none"
    >
      <div class="flex justify-center pt-2.5 pb-0.5">
        <PanelHandle />
      </div>
      <div class="flex items-center gap-2 px-(--page-inset) pt-0.5 pb-1.5 {column ? CHAT_COLUMN_CLASS : ''}">
        <QUICK_CHAT_ICON size={16} class="shrink-0 text-accent" />
        <p class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">{t("QUICK_CHAT")}</p>
        <TooltipIconButton label={t("CLEAR")} enabled={messages.length > 0} onclick={onClear} class="size-7">
          <Eraser />
        </TooltipIconButton>
      </div>
    </div>
    <div class="relative min-h-0 flex-1">
      <ChatScroller
        bind:this={scroller}
        bind:follow
        hasContent={messages.length > 0}
        {bottomInset}
        contentClass={column ? CHAT_COLUMN_CLASS : ""}
      >
        {#each messages as item, index (item.id)}
          <div data-mid={item.id}>
            <MessageItem
              message={item}
              prevRole={messages[index - 1]?.role ?? null}
              nextRole={messages[index + 1]?.role ?? null}
              running={item.role === "working" && index === messages.length - 1 && streaming}
              expanded={expansion.isOpen(item.id)}
              onToggle={() => scroller?.toggleBlock(item.id, expansion)}
              onGrow={grow}
              {onAnswer}
              {component}
              onSuggest={index > lastUserAt ? onSuggest : null}
              timestamps={false}
            />
          </div>
        {/each}
      </ChatScroller>
    </div>
  </div>
</div>
