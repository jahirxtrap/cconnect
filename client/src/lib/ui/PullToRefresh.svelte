<script lang="ts">
  import type { Snippet } from "svelte";
  import { isTouch } from "$lib/platform";
  import { PullState } from "./pull.svelte";
  import PullIndicator from "./PullIndicator.svelte";

  interface Props {
    refreshing?: boolean;
    onRefresh?: (() => void) | null;
    children: Snippet;
  }

  const { refreshing = false, onRefresh = null, children }: Props = $props();

  const pull = new PullState();

  let scroller = $state<HTMLDivElement | null>(null);
  let tracking = false;
  let distance = 0;
  let lastY = 0;

  const enabled = $derived(isTouch && !!onRefresh);

  const onStart = (event: TouchEvent) => {
    if (!enabled || refreshing || pull.animating) return;
    lastY = event.touches[0].clientY;
    distance = 0;
    tracking = true;
  };

  const onMove = (event: TouchEvent) => {
    if (!tracking || !scroller) return;
    const y = event.touches[0].clientY;
    const delta = y - lastY;
    lastY = y;
    if (distance === 0 && (delta <= 0 || scroller.scrollTop > 0)) return;
    distance = Math.max(0, distance + delta);
    pull.drag(distance);
    if (distance > 0) event.preventDefault();
  };

  const onEnd = () => {
    if (!tracking) return;
    tracking = false;
    const pulled = distance;
    distance = 0;
    if (pull.release(pulled)) onRefresh?.();
  };

  const touches = (node: HTMLDivElement) => {
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
    if (pull.dragging) return;
    pull.settle(refreshing ? 1 : 0);
  });

  $effect(() => () => pull.dispose());
</script>

<div class="relative min-h-0 flex-1">
  <div bind:this={scroller} use:touches class="h-full overflow-y-auto">
    {@render children()}
  </div>
  <PullIndicator fraction={pull.fraction} {refreshing} />
</div>
