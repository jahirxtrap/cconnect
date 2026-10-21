<script lang="ts">
  import type { Snippet } from "svelte";
  import { provideScale } from "./modGrid";

  interface Props {
    room: number;
    watch: unknown;
    fresh: boolean;
    children: Snippet;
  }

  const { room, watch, fresh, children }: Props = $props();

  const SLACK = 1;

  let frame = $state<HTMLElement | null>(null);
  let scale = $state(1);

  provideScale(() => scale);

  $effect(() => {
    void watch;
    if (!frame || !room || !fresh) return;
    frame.style.zoom = "";
    const natural = frame.scrollWidth;
    const next = natural - room > SLACK ? room / natural : 1;
    frame.style.zoom = next < 1 ? String(next) : "";
    scale = next;
  });
</script>

<div bind:this={frame} class="flex min-h-0 min-w-0 flex-1 flex-col">{@render children()}</div>
