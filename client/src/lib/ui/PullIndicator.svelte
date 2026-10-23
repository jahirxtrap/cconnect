<script lang="ts">
  import CenteredProgress from "./CenteredProgress.svelte";
  import { PULL_REACH } from "./pull.svelte";

  interface Props {
    fraction: number;
    refreshing: boolean;
  }

  const { fraction, refreshing }: Props = $props();

  const CONTAINER = 40;
  const SPINNER = 18;
  const SPINNER_STROKE = 2.5;

  const scale = $derived(Math.min(1, fraction));
</script>

{#if refreshing || fraction > 0}
  <div
    style="width: {CONTAINER}px; height: {CONTAINER}px; opacity: {scale}; transform: translate(-50%, {fraction *
      PULL_REACH -
      CONTAINER}px) scale({scale})"
    class="pointer-events-none absolute top-0 left-1/2 flex items-center justify-center rounded-full bg-surface-variant shadow-md"
  >
    <CenteredProgress size={SPINNER} stroke={SPINNER_STROKE} />
  </div>
{/if}
