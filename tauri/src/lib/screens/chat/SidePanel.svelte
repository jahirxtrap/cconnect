<script lang="ts">
  import Eraser from "@lucide/svelte/icons/eraser";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import type { ChatMessage, InteractionData } from "$lib/data/chatModels";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import MessageItem from "./blocks/MessageItem.svelte";

  interface Props {
    messages: ChatMessage[];
    height: number;
    onHeight: (value: number) => void;
    onDragging: (value: boolean) => void;
    onClear: () => void;
    onClose: () => void;
    onAnswer: (requestId: string, optionId: string) => void;
    questions?: import("svelte").Snippet<[InteractionData]>;
  }

  const { messages, height, onHeight, onDragging, onClear, onClose, onAnswer, questions }: Props =
    $props();

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

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (list) list.scrollTop = list.scrollHeight;
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

  <div bind:this={list} class="selectable min-h-0 flex-1 overflow-y-auto pt-1.5">
    {#each messages as item, index (item.id)}
      <MessageItem
        message={item}
        prevRole={messages[index - 1]?.role ?? null}
        nextRole={messages[index + 1]?.role ?? null}
        running={false}
        {onAnswer}
        {questions}
      />
    {/each}
  </div>
</div>
