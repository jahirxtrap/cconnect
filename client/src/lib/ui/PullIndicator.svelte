<script lang="ts">
  import CenteredProgress from "./CenteredProgress.svelte";
  import { PULL_REACH, type PullState } from "./pull.svelte";

  interface Props {
    pull: PullState;
    refreshing: boolean;
  }

  const { pull, refreshing }: Props = $props();

  const CONTAINER = 40;
  const SPINNER = 18;
  const SPINNER_STROKE = 2.5;
  const HINT_OPACITY = 0.3;

  const scale = $derived(Math.min(1, pull.fraction));
</script>

{#if refreshing || pull.fraction > 0}
  <div
    style="width: {CONTAINER}px; height: {CONTAINER}px; opacity: {scale}; transform: translate(-50%, {pull.fraction *
      PULL_REACH -
      CONTAINER}px) scale({scale})"
    class="pointer-events-none absolute top-0 left-1/2 flex items-center justify-center rounded-full bg-surface-variant shadow-md"
  >
    <div class="transition-opacity" style="opacity: {pull.held && pull.progress < 1 ? HINT_OPACITY : 1}">
      <CenteredProgress size={SPINNER} stroke={SPINNER_STROKE} hold={pull.held ? pull.arc : null} />
    </div>
  </div>
{/if}
