<script lang="ts">
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";

  interface Props {
    open: boolean;
    onDismiss: () => void;
    onOpen?: (() => void) | null;
    width?: number;
    children: Snippet;
  }

  const { open, onDismiss, onOpen = null, width = 300, children }: Props = $props();

  const EDGE = 20;
  const SLOP = 6;
  const HALF = 2;

  let offset = $state(0);
  let dragging = $state(false);

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let decided = false;

  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!open && (!onOpen || touch.clientX > EDGE)) return;
    tracking = true;
    decided = false;
    dragging = false;
    startX = touch.clientX;
    startY = touch.clientY;
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
    offset = Math.min(width, Math.max(0, (open ? width : 0) + dx));
    event.preventDefault();
  };

  const onEnd = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    if (offset > width / HALF) onOpen?.();
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
  class="fixed inset-y-0 left-0 z-40 {dragging ? '' : 'transition-transform duration-200'}"
  style="width: {width}px; transform: translateX({dragging ? offset - width : open ? 0 : -width}px)"
>
  {@render children()}
</aside>
