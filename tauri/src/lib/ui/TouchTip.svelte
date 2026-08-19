<script lang="ts">
  import { Portal } from "bits-ui";
  import { layout } from "$lib/platform/layout.svelte";

  interface Props {
    text: string;
    anchor: { x: number; top: number; bottom: number } | null;
    onDismiss?: (() => void) | null;
  }

  const { text, anchor, onDismiss = null }: Props = $props();

  $effect(() => {
    if (anchor === null || !onDismiss) return;
    const close = () => onDismiss();
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  });

  const GAP = 4;
  const EDGE = 8;
  const HALF = 2;

  let width = $state(0);
  let height = $state(0);

  const minLeft = $derived(layout.safeLeft + EDGE);
  const maxLeft = $derived(Math.max(minLeft, window.innerWidth - layout.safeRight - width - EDGE));
  const left = $derived(anchor === null ? 0 : Math.min(Math.max(anchor.x - width / HALF, minLeft), maxLeft));

  const above = $derived(anchor !== null && anchor.top - GAP - height >= layout.safeTop + EDGE);
  const top = $derived(
    anchor === null ? 0 : above ? anchor.top - GAP - height : anchor.bottom + GAP,
  );
</script>

{#if anchor}
  <Portal>
    <div
      bind:clientWidth={width}
      bind:clientHeight={height}
      style="left: {left}px; top: {top}px"
      class="pointer-events-none fixed z-75 rounded-sm bg-surface-variant px-2 py-1 text-body-sm whitespace-nowrap shadow-lg"
    >
      {text}
    </div>
  </Portal>
{/if}
