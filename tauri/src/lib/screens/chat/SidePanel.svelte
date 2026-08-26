<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import Eraser from "@lucide/svelte/icons/eraser";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import { isPending, type ChatMessage, type InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";
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
  }: Props = $props();

  const PEEK = 58;
  const MIN = 0;
  const MAX = 100;
  const CLOSE_BELOW = 32;
  const FULL_ABOVE = (PEEK + MAX) / 2;
  const PERCENT = 100;

  let list = $state<HTMLDivElement | null>(null);
  let panel = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  const onPointerDown = (event: PointerEvent) => {
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

  const AT_BOTTOM_PX = 4;
  const SETTLE_MS = 120;
  const OWN_TOP_PX = 1;
  const SCROLL_END = "onscrollend" in window;
  const HALF = 2;
  const SCROLL_BUTTON_GAP = 12;

  let follow = $state(true);
  let belowFold = $state(0);
  let viewport = $state(0);
  let horizontalScrollbar = $state(0);
  let verticalScrollbar = $state(0);
  let ownTop = -1;
  let lastTop = 0;
  let smooth = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPrompt: number | null = null;
  let exitFrom = 0;

  const shown = $derived(Math.min(MAX, Math.max(PEEK, height)));
  const hiddenFraction = $derived(Math.max(0, (PEEK - Math.max(MIN, height)) / PEEK));

  const distanceToBottom = () => (list ? Math.abs(list.scrollTop) : 0);

  const scrollToEnd = () => {
    if (!list) return;
    list.scrollTop = 0;
    ownTop = list.scrollTop;
    lastTop = list.scrollTop;
  };

  const smoothToEnd = () => {
    if (!list) return;
    smooth = true;
    list.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stopFollowing = () => {
    follow = false;
  };

  const onwheel = (event: WheelEvent) => {
    if (event.deltaY < 0) stopFollowing();
  };

  const settle = () => {
    settleTimer = null;
    smooth = false;
    if (distanceToBottom() <= AT_BOTTOM_PX) follow = true;
  };

  const onscroll = () => {
    if (!list) return;
    const top = list.scrollTop;
    const movedUp = Math.abs(top) > Math.abs(lastTop) + OWN_TOP_PX;
    lastTop = top;
    belowFold = distanceToBottom();
    viewport = list.clientHeight;
    verticalScrollbar = list.offsetWidth - list.clientWidth;
    horizontalScrollbar = list.offsetHeight - list.clientHeight;
    const ours = smooth || Math.abs(top - ownTop) <= OWN_TOP_PX;
    ownTop = -1;
    if (!ours && movedUp && belowFold > AT_BOTTOM_PX) follow = false;
    if (!SCROLL_END) {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SETTLE_MS);
    }
  };

  const toBottom = () => {
    follow = true;
    smoothToEnd();
  };

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (follow) scrollToEnd();
  });

  $effect(() => {
    const last = messages.at(-1);
    const id = last?.id ?? null;
    if (id === lastPrompt) return;
    lastPrompt = id;
    if (!last || last.role !== "interaction" || !last.interaction || !isPending(last.interaction)) return;
    follow = true;
    smoothToEnd();
  });

  $effect(() => () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
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
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={list}
      {onscroll}
      {onwheel}
      onscrollend={settle}
      ontouchmove={stopFollowing}
      class="selectable flex h-full flex-col-reverse overflow-x-hidden overflow-y-auto"
    >
      <div class="mb-auto shrink-0">
        {#each messages as item, index (item.id)}
          <MessageItem
            message={item}
            prevRole={messages[index - 1]?.role ?? null}
            nextRole={messages[index + 1]?.role ?? null}
            running={item.role === "working" && index === messages.length - 1 && streaming}
            {onAnswer}
            {component}
          />
        {/each}
      </div>
    </div>

    {#if !follow && messages.length && viewport > 0 && belowFold > viewport / HALF}
      <button
        type="button"
        onclick={toBottom}
        title={t("SCROLL_TO_BOTTOM")}
        aria-label={t("SCROLL_TO_BOTTOM")}
        style="bottom: {SCROLL_BUTTON_GAP + horizontalScrollbar}px; right: {SCROLL_BUTTON_GAP + verticalScrollbar}px"
        class="absolute inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
      >
        <ChevronsDown size={24} />
      </button>
    {/if}
  </div>
</div>
