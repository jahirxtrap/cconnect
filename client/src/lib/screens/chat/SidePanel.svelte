<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import { tick } from "svelte";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import ChatScroller from "./ChatScroller.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
  import StickyHeader from "./blocks/StickyHeader.svelte";
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
    bottomInset?: number;
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
    bottomInset = 0,
  }: Props = $props();

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
        exitFrom = hiddenFraction;
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

  const TOP_CORNER = 20;

  const corner = $derived(
    TOP_CORNER * (1 - Math.min(1, Math.max(0, (height - PEEK) / (MAX - PEEK)))),
  );

  let follow = $state(true);
  let scroller = $state<ChatScroller | null>(null);

  const messageOf = (node: HTMLElement) => messages.find((item) => item.id === Number(node.dataset.mid)) ?? null;

  const collapseHeader = async (node: HTMLElement) => {
    const toggle = node.querySelector<HTMLElement>("[data-block] > button");
    if (!toggle || !scroller) return;
    toggle.click();
    await tick();
    const block = node.querySelector<HTMLElement>("[data-block]") ?? node;
    scroller.bringToTop(block);
    scroller.refreshHeader();
  };
  let lastPrompt: number | null = null;
  let exitFrom = 0;

  const shown = $derived(Math.min(MAX, Math.max(PEEK, height)));
  const hiddenFraction = $derived(Math.max(0, (PEEK - Math.max(MIN, height)) / PEEK));

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
      css: (progress: number) => `transform: translateY(${(from + (1 - from) * (1 - progress)) * PERCENT}%)`,
    };
  };
</script>

<div
  bind:this={panel}
  transition:slide={{ duration: instant ? 0 : PANEL_MS }}
  class="absolute inset-x-0 bottom-0 z-10 flex min-h-0 flex-col overflow-hidden bg-background {dragging || instant
    ? ''
    : 'transition-[height] duration-[350ms] ease-[cubic-bezier(0.33,1,0.68,1)]'}"
  style="height: {shown}%; transform: translateY({hiddenFraction * PERCENT}%); border-top-left-radius: {corner}px; border-top-right-radius: {corner}px"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    onpointerdown={onPointerDown}
    ondblclick={toggleFull}
    role="separator"
    aria-orientation="horizontal"
    class="shrink-0 cursor-ns-resize touch-none"
  >
    <div class="flex justify-center pt-2.5 pb-0.5">
      <span class="h-1 w-8 rounded-[2px] bg-on-surface-variant/40"></span>
    </div>
    <div class="flex items-center px-4 pt-0.5 pb-1.5">
      <MessagesSquare size={18} class="mr-2 shrink-0 text-accent" />
      <p class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">{t("QUICK_CHAT")}</p>
      <TooltipIconButton
        label={t("CLEAR")}
        enabled={messages.length > 0}
        onclick={onClear}
        class="size-[18px] [&_svg]:size-[18px]"
      >
        <Eraser />
      </TooltipIconButton>
    </div>
  </div>
  <div class="h-px shrink-0 bg-outline-variant"></div>

  <div class="relative min-h-0 flex-1">
    <ChatScroller bind:this={scroller} bind:follow hasContent={messages.length > 0} {bottomInset}>
      {#each messages as item, index (item.id)}
        <div data-mid={item.id}>
          <MessageItem
            message={item}
            prevRole={messages[index - 1]?.role ?? null}
            nextRole={messages[index + 1]?.role ?? null}
            running={item.role === "working" && index === messages.length - 1 && streaming}
            {onAnswer}
            {component}
          />
        </div>
      {/each}
      {#snippet header(node: HTMLElement)}
        {@const message = messageOf(node)}
        {#if message}
          <StickyHeader {message} onCollapse={() => collapseHeader(node)} />
        {/if}
      {/snippet}
    </ChatScroller>
  </div>
</div>
