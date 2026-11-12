<script lang="ts">
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { layout } from "$lib/platform/layout.svelte";
  import { dismissMenus, menusOpen } from "./MenuScrim.svelte";
  import { FLING_SPEED, Velocity } from "./velocity";
  import { pushDismiss } from "$lib/app/dismissStack";

  interface Props {
    open: boolean;
    onDismiss: () => void;
    onOpen?: (() => void) | null;
    width?: number;
    children: Snippet;
  }

  const MAX_WIDTH = 360;

  const { open, onDismiss, onOpen = null, width = MAX_WIDTH, children }: Props = $props();

  const SLOP = 6;
  const HALF = 2;

  let offset = $state(0);
  let dragging = $state(false);

  let startX = 0;
  let startY = 0;
  let tracking = false;
  let decided = false;
  const velocity = new Velocity();

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

  const handlesSwipe = (target: EventTarget | null) =>
    target instanceof Element && target.closest("[data-swipe]") !== null;

  const blockTap = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const guardTaps = (on: boolean) => {
    for (const type of ["contextmenu", "pointerup"]) {
      if (on) window.addEventListener(type, blockTap, true);
      else window.removeEventListener(type, blockTap, true);
    }
  };

  const onStart = (event: TouchEvent) => {
    if (menusOpen() || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    const touch = event.touches[0];
    if (!open && !onOpen) return;
    if (scrollsHorizontally(event.target) || handlesSwipe(event.target)) return;
    tracking = true;
    decided = false;
    dragging = false;
    startX = touch.clientX;
    startY = touch.clientY;
    velocity.start(touch.clientX, event.timeStamp);
    offset = open ? sheetWidth : 0;
  };

  const onMove = (event: TouchEvent) => {
    if (!tracking) return;
    const touch = event.touches[0];
    velocity.add(touch.clientX, event.timeStamp);
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
      guardTaps(true);
    }
    offset = Math.min(sheetWidth, Math.max(0, (open ? sheetWidth : 0) + dx));
    event.preventDefault();
  };

  const onEnd = (event: TouchEvent) => {
    guardTaps(false);
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    const speed = velocity.at(event.timeStamp);
    const flung = Math.abs(speed) > FLING_SPEED;
    const opening = flung ? speed > 0 : offset > sheetWidth / HALF;
    if (opening) onOpen?.();
    else onDismiss();
  };

  $effect(() => {
    if (!isTouch) return;
    const start = onStart as EventListener;
    const move = onMove as EventListener;
    const end = onEnd as EventListener;
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
      guardTaps(false);
    };
  });

  const sheetWidth = $derived(Math.min(width, layout.width));

  const onScreen = $derived(open || dragging);

  const shade = $derived(dragging ? offset / sheetWidth : open ? 1 : 0);

  $effect(() => {
    if (!open) dismissMenus();
  });

  $effect(() => {
    if (!open) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return pushDismiss(onDismiss, { modal: false });
  });
</script>

{#if onScreen}
  <div
    class="fixed inset-0 z-40 bg-black/32 will-change-[opacity] {dragging ? '' : 'transition-opacity duration-200'}"
    style="opacity: {shade}"
    role="presentation"
    onclick={onDismiss}
    onkeydown={(event) => event.key === "Escape" && onDismiss()}
  ></div>
{/if}
<aside
  class="fixed inset-y-0 left-0 z-40 overflow-hidden rounded-r-2xl bg-surface will-change-transform {onScreen
    ? ''
    : 'invisible'} {dragging ? '' : 'transition-[transform,visibility] duration-200'}"
  style="width: {sheetWidth}px; padding-top: var(--safe-top); padding-bottom: var(--safe-bottom); transform: translateX({dragging
    ? offset - sheetWidth
    : open
      ? 0
      : -sheetWidth}px)"
>
  {@render children()}
</aside>
