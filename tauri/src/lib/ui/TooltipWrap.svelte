<script lang="ts">
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import TouchTip from "./TouchTip.svelte";

  interface Props {
    label: string;
    class?: string;
    children: Snippet;
  }

  const { label, class: className = "", children }: Props = $props();

  const LONG_PRESS_MS = 500;
  const PRESS_SLOP = 10;
  const TOUCH_HIDE_MS = 1500;
  const HALF = 2;

  let tip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  let startX = 0;
  let startY = 0;

  const anchorOf = (element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / HALF, top: box.top, bottom: box.bottom };
  };

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const hide = () => {
    clear();
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    tip = null;
  };

  const pressStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    const anchor = anchorOf(event.currentTarget as HTMLElement);
    startX = touch.clientX;
    startY = touch.clientY;
    clear();
    timer = setTimeout(() => {
      tip = anchor;
      hideTimer = setTimeout(() => (tip = null), TOUCH_HIDE_MS);
    }, LONG_PRESS_MS);
  };

  const pressMove = (event: TouchEvent) => {
    if (timer === null) return;
    const touch = event.touches[0];
    if (Math.abs(touch.clientX - startX) > PRESS_SLOP || Math.abs(touch.clientY - startY) > PRESS_SLOP) clear();
  };

  const enter = (event: MouseEvent) => {
    clear();
    tip = anchorOf(event.currentTarget as HTMLElement);
  };
</script>

{#if isTouch}
  <span
    role="presentation"
    class={className}
    ontouchstart={pressStart}
    ontouchmove={pressMove}
    ontouchend={clear}
    ontouchcancel={clear}
  >
    {@render children()}
  </span>
{:else}
  <span role="presentation" class={className} onmouseenter={enter} onmouseleave={hide} onclick={hide}>
    {@render children()}
  </span>
{/if}
<TouchTip text={label} anchor={tip} onDismiss={() => (tip = null)} />
