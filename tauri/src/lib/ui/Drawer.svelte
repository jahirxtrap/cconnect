<script lang="ts">
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { dismissMenus, menusOpen } from "./MenuScrim.svelte";

  interface Props {
    open: boolean;
    onDismiss: () => void;
    onOpen?: (() => void) | null;
    width?: number;
    children: Snippet;
  }

  const { open, onDismiss, onOpen = null, width = 300, children }: Props = $props();

  const SLOP = 6;
  const HALF = 2;
  const FLING_SPEED = 350;

  let offset = $state(0);
  let dragging = $state(false);

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let decided = false;
  let lastX = 0;
  let lastAt = 0;
  let speed = 0;

  const scrollsHorizontally = (target: EventTarget | null) => {
    let node = target as HTMLElement | null;
    while (node && node !== document.body) {
      if (node.scrollWidth > node.clientWidth + 1) {
        const overflow = getComputedStyle(node).overflowX;
        if (overflow === "auto" || overflow === "scroll") return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const onStart = (event: TouchEvent) => {
    if (menusOpen()) return;
    const touch = event.touches[0];
    if (!open && !onOpen) return;
    if (scrollsHorizontally(event.target)) return;
    tracking = true;
    decided = false;
    dragging = false;
    startX = touch.clientX;
    startY = touch.clientY;
    lastX = touch.clientX;
    lastAt = event.timeStamp;
    speed = 0;
    offset = open ? width : 0;
  };

  const onMove = (event: TouchEvent) => {
    if (!tracking) return;
    const touch = event.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
      decided = true;
      dragging = Math.abs(dx) > Math.abs(dy);
      if (!dragging) {
        tracking = false;
        return;
      }
    }
    const elapsed = event.timeStamp - lastAt;
    if (elapsed > 0) speed = ((touch.clientX - lastX) / elapsed) * 1000;
    lastX = touch.clientX;
    lastAt = event.timeStamp;
    offset = Math.min(width, Math.max(0, (open ? width : 0) + dx));
    event.preventDefault();
  };

  const onEnd = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const flung = Math.abs(speed) > FLING_SPEED;
    const opening = flung ? speed > 0 : offset > width / HALF;
    if (opening) onOpen?.();
    else onDismiss();
  };

  $effect(() => {
    if (!isTouch) return;
    const start = onStart as EventListener;
    const move = onMove as EventListener;
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  });

  const shade = $derived(dragging ? offset / width : open ? 1 : 0);

  $effect(() => {
    if (!open) dismissMenus();
  });
</script>

{#if open || dragging}
  <div
    class="fixed inset-0 z-40 bg-black/40 {dragging ? '' : 'transition-opacity duration-200'}"
    style="opacity: {shade}"
    role="presentation"
    onclick={onDismiss}
    onkeydown={(event) => event.key === "Escape" && onDismiss()}
  ></div>
{/if}
<aside
  class="fixed inset-y-0 left-0 z-40 border-r border-outline-variant bg-surface {dragging
    ? ''
    : 'transition-transform duration-200'}"
  style="width: {width}px; padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); transform: translateX({dragging
    ? offset - width
    : open
      ? 0
      : -width}px)"
>
  {@render children()}
</aside>
