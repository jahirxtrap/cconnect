<script lang="ts">
  interface Props {
    points: number[];
    capacity: number;
    class?: string;
  }

  const { points, capacity, class: className = "" }: Props = $props();

  const VIEW_WIDTH = 100;
  const VIEW_HEIGHT = 40;
  const INSET = 2;
  const PERCENT = 100;

  const path = $derived.by(() => {
    if (points.length < 2) return null;
    const step = VIEW_WIDTH / (capacity - 1);
    const startX = VIEW_WIDTH - (points.length - 1) * step;
    const span = VIEW_HEIGHT - INSET * 2;
    const yOf = (value: number) => INSET + span * (1 - Math.min(1, Math.max(0, value / PERCENT)));
    const line = points
      .map((value, index) => `${index === 0 ? "M" : "L"}${startX + index * step} ${yOf(value)}`)
      .join(" ");
    return { line, fill: `${line} L${VIEW_WIDTH} ${VIEW_HEIGHT} L${startX} ${VIEW_HEIGHT} Z` };
  });
</script>

<div class="overflow-hidden rounded-panel bg-surface-variant {className}">
  {#if path}
    <svg
      viewBox="0 0 {VIEW_WIDTH} {VIEW_HEIGHT}"
      preserveAspectRatio="none"
      class="h-full w-full"
      aria-hidden="true"
    >
      <path d={path.fill} fill="currentColor" class="text-accent/15" />
      <path
        d={path.line}
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
        class="text-accent"
      />
    </svg>
  {/if}
</div>
