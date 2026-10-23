<script lang="ts">
  import type { Snippet } from "svelte";
  import { provideScale, spanOf } from "./modGrid";

  interface Props {
    room: number;
    watch: unknown;
    fresh: boolean;
    hold: number;
    onMeasure?: ((span: number) => void) | null;
    children: Snippet;
  }

  const { room, watch, fresh, hold, onMeasure = null, children }: Props = $props();

  const SLACK = 1;

  let frame = $state<HTMLElement | null>(null);
  let scale = $state(1);

  provideScale(() => scale);

  $effect(() => {
    void watch;
    void hold;
    if (!frame || !room || !fresh) return;
    frame.style.zoom = "";
    if (onMeasure) {
      const held = frame.style.minWidth;
      frame.style.minWidth = "";
      onMeasure(spanOf(frame));
      frame.style.minWidth = held;
    }
    const natural = frame.scrollWidth;
    const next = natural - room > SLACK ? room / natural : 1;
    frame.style.zoom = next < 1 ? String(next) : "";
    scale = next;
  });
</script>

<div bind:this={frame} style:min-width={hold ? `${hold}px` : null} class="flex min-h-0 min-w-0 flex-1 flex-col">
  {@render children()}
</div>
