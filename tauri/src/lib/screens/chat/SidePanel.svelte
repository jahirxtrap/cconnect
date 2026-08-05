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
    onClear: () => void;
    onClose: () => void;
    onAnswer: (requestId: string, optionId: string) => void;
    questions?: import("svelte").Snippet<[InteractionData]>;
  }

  const { messages, height, onHeight, onClear, onClose, onAnswer, questions }: Props = $props();

  const PEEK = 45;
  const MIN = 22;
  const MAX = 100;
  const CLOSE_BELOW = 18;
  const PERCENT = 100;

  let list = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  const onPointerDown = (event: PointerEvent) => {
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging = true;
    let live = height;

    const move = (drag: PointerEvent) => {
      const viewport = window.innerHeight;
      if (viewport <= 0) return;
      live = Math.min(MAX, Math.max(MIN, live - (drag.movementY / viewport) * PERCENT));
      onHeight(live);
    };

    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      dragging = false;
      if (live <= CLOSE_BELOW) {
        onHeight(PEEK);
        onClose();
      }
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const toggleFull = () => onHeight(height >= MAX ? PEEK : MAX);

  $effect(() => {
    void messages.at(-1)?.text;
    void messages.length;
    if (list) list.scrollTop = list.scrollHeight;
  });
</script>

<div
  class="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-t-xl border-t border-outline-variant bg-background {dragging
    ? ''
    : 'transition-[height] duration-150'}"
  style="height: {Math.min(MAX, Math.max(MIN, height))}%"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    onpointerdown={onPointerDown}
    ondblclick={toggleFull}
    role="separator"
    aria-orientation="horizontal"
    class="flex shrink-0 cursor-ns-resize touch-none justify-center pt-2.5 pb-1"
  >
    <span class="h-1 w-8 rounded-xs bg-on-surface-variant/40"></span>
  </div>

  <div class="flex h-8 shrink-0 items-center gap-2 px-4">
    <MessagesSquare size={18} class="shrink-0 text-accent" />
    <p class="min-w-0 flex-1 truncate text-label-lg">{t("QUICK_CHAT")}</p>
    <TooltipIconButton label={t("CLEAR")} enabled={messages.length > 0} onclick={onClear} class="size-8">
      <Eraser size={18} />
    </TooltipIconButton>
  </div>

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
