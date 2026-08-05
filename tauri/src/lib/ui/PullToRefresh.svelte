<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import CenteredProgress from "./CenteredProgress.svelte";

  interface Props {
    refreshing?: boolean;
    onRefresh?: (() => void) | null;
    children: Snippet;
  }

  const { refreshing = false, onRefresh = null, children }: Props = $props();

  const THRESHOLD = 80;
  const RESISTANCE = 0.5;
  const CONTAINER = 40;
  const SPINNER = 18;
  const SPINNER_STROKE = 2;
  const STIFFNESS = 1500;

  let scroller = $state<HTMLDivElement | null>(null);
  let fraction = $state(0);
  let dragging = $state(false);

  let distance = 0;
  let lastY = 0;
  let frame = 0;
  let animating = false;

  const fractionOf = (pulled: number) => {
    const adjusted = pulled * RESISTANCE;
    if (adjusted <= THRESHOLD) return adjusted / THRESHOLD;
    const overshoot = Math.min(adjusted / THRESHOLD - 1, 2);
    return 1 + overshoot - (overshoot * overshoot) / 4;
  };

  const animateTo = (target: number) => {
    cancelAnimationFrame(frame);
    const from = untrack(() => fraction);
    if (from === target) {
      animating = false;
      return;
    }
    animating = true;
    const omega = Math.sqrt(STIFFNESS);
    const started = performance.now();
    const step = (now: number) => {
      const elapsed = (now - started) / 1000;
      const progress = 1 - (1 + omega * elapsed) * Math.exp(-omega * elapsed);
      if (progress >= 0.999) {
        fraction = target;
        animating = false;
        return;
      }
      fraction = from + (target - from) * progress;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const enabled = $derived(isTouch && !!onRefresh);

  const onStart = (event: TouchEvent) => {
    if (!enabled || refreshing || animating) return;
    lastY = event.touches[0].clientY;
    distance = 0;
    dragging = true;
  };

  const onMove = (event: TouchEvent) => {
    if (!dragging || !scroller) return;
    const y = event.touches[0].clientY;
    const delta = y - lastY;
    lastY = y;
    if (distance === 0 && (delta <= 0 || scroller.scrollTop > 0)) return;
    distance = Math.max(0, distance + delta);
    fraction = fractionOf(distance);
    if (distance > 0) event.preventDefault();
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    const pulled = distance * RESISTANCE;
    distance = 0;
    if (pulled > THRESHOLD) onRefresh?.();
  };

  const pull = (node: HTMLDivElement) => {
    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd);
    node.addEventListener("touchcancel", onEnd);
    return {
      destroy() {
        node.removeEventListener("touchstart", onStart);
        node.removeEventListener("touchmove", onMove);
        node.removeEventListener("touchend", onEnd);
        node.removeEventListener("touchcancel", onEnd);
      },
    };
  };

  $effect(() => {
    if (dragging) return;
    animateTo(refreshing ? 1 : 0);
  });

  $effect(() => () => cancelAnimationFrame(frame));

  const scale = $derived(Math.min(1, fraction));
  const visible = $derived(refreshing || fraction > 0);
</script>

<div class="relative min-h-0 flex-1">
  <div bind:this={scroller} use:pull class="h-full overflow-y-auto">
    {@render children()}
  </div>

  {#if visible}
    <div
      style="width: {CONTAINER}px; height: {CONTAINER}px; opacity: {scale}; transform: translate(-50%, {fraction *
        THRESHOLD -
        CONTAINER}px) scale({scale})"
      class="pointer-events-none absolute top-0 left-1/2 flex items-center justify-center rounded-full bg-surface-variant shadow-md"
    >
      <CenteredProgress size={SPINNER} stroke={SPINNER_STROKE} />
    </div>
  {/if}
</div>
