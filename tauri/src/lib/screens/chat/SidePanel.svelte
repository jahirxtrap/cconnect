<script lang="ts">
  import ChevronsDown from "@lucide/svelte/icons/chevrons-down";
  import Eraser from "@lucide/svelte/icons/eraser";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import type { ChatMessage, InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";

  interface Props {
    messages: ChatMessage[];
    streaming: boolean;
    height: number;
    onHeight: (value: number) => void;
    onDragging: (value: boolean) => void;
    onClear: () => void;
    onClose: () => void;
    onAnswer: (requestId: string, optionId: string) => void;
    questions?: import("svelte").Snippet<[InteractionData]>;
  }

  const {
    messages,
    streaming,
    height,
    onHeight,
    onDragging,
    onClear,
    onClose,
    onAnswer,
    questions,
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
  const HALF = 2;
  const SCROLL_BUTTON_GAP = 12;

  let follow = $state(true);
  let belowFold = $state(0);
  let viewport = $state(0);
  let lastTop = 0;
  let programmatic = false;

  const scrollToEnd = () => {
    if (!list) return;
    programmatic = true;
    list.scrollTop = list.scrollHeight;
    lastTop = list.scrollTop;
  };

  const onscroll = () => {
    if (!list) return;
    const top = list.scrollTop;
    const manual = !programmatic;
    programmatic = false;
    if (manual && top < lastTop) follow = false;
    lastTop = top;
    belowFold = list.scrollHeight - top - list.clientHeight;
    viewport = list.clientHeight;
    if (belowFold <= AT_BOTTOM_PX) follow = true;
  };

  const toBottom = () => {
    if (!list) return;
    follow = true;
    programmatic = true;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  };

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (follow) scrollToEnd();
  });
</script>

<div
  bind:this={panel}
  class="absolute inset-x-0 bottom-0 z-10 flex min-h-0 flex-col overflow-hidden bg-background {dragging
    ? ''
    : 'transition-[height] duration-200 ease-out'}"
  style="height: {Math.min(MAX, Math.max(MIN, height))}%; border-top-left-radius: {corner}px; border-top-right-radius: {corner}px"
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
      <span class="h-1 w-8 rounded-xs bg-on-surface-variant/40"></span>
    </div>
    <div class="flex items-center gap-2 px-4 pt-0.5 pb-1.5">
      <MessagesSquare size={18} class="shrink-0 text-accent" />
      <p class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">{t("QUICK_CHAT")}</p>
      <TooltipIconButton label={t("CLEAR")} enabled={messages.length > 0} onclick={onClear} class="size-8">
        <Eraser size={18} />
      </TooltipIconButton>
    </div>
  </div>
  <div class="h-px shrink-0 bg-outline-variant"></div>

  <div class="relative min-h-0 flex-1">
    <div bind:this={list} {onscroll} class="selectable h-full overflow-y-auto pt-1.5">
      {#each messages as item, index (item.id)}
        <MessageItem
          message={item}
          prevRole={messages[index - 1]?.role ?? null}
          nextRole={messages[index + 1]?.role ?? null}
          running={item.role === "working" && index === messages.length - 1 && streaming}
          {onAnswer}
          {questions}
        />
      {/each}
    </div>

    {#if !follow && messages.length && viewport > 0 && belowFold > viewport / HALF}
      <button
        type="button"
        onclick={toBottom}
        title={t("SCROLL_TO_BOTTOM")}
        aria-label={t("SCROLL_TO_BOTTOM")}
        style="bottom: {SCROLL_BUTTON_GAP}px; right: {SCROLL_BUTTON_GAP}px"
        class="absolute inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-on-background text-background shadow-md transition-opacity hover:opacity-90"
      >
        <ChevronsDown size={18} />
      </button>
    {/if}
  </div>
</div>
