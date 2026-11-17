<script lang="ts">
  import { drawInto } from "$lib/markdown/drawing";

  interface Props {
    svg: string;
    drawn?: SVGSVGElement | null;
    class?: string;
  }

  let { svg, drawn = $bindable(null), class: className = "" }: Props = $props();

  const REDRAW_INTERVAL_MS = 200;

  let host = $state<HTMLDivElement | null>(null);
  let drawnAt = 0;

  const markup = $derived(svg);

  $effect(() => {
    const target = host;
    const source = markup;
    if (!target) return;
    const timer = setTimeout(
      () => {
        drawnAt = performance.now();
        drawn = drawInto(target, source);
      },
      Math.max(0, drawnAt + REDRAW_INTERVAL_MS - performance.now()),
    );
    return () => clearTimeout(timer);
  });
</script>

<div bind:this={host} class={className}></div>
