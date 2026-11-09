<script lang="ts" module>
  export interface SpinnerHold {
    sweep: number;
    turn: number;
  }
</script>

<script lang="ts">
  interface Props {
    size?: number;
    stroke?: number;
    hold?: SpinnerHold | null;
    class?: string;
  }

  const { size = 32, stroke = 4, hold = null, class: className = "" }: Props = $props();

  const LEFT_START = 135;
  const RIGHT_START = 225;
  const DEGREES = 180 / Math.PI;
  const HALF = 2;

  const center = $derived(size / 2);
  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const capDegrees = $derived((stroke / radius) * DEGREES);
  const dash = $derived(`${circumference / 2 - stroke} ${circumference}`);

  let frame = $state<HTMLDivElement | null>(null);
  let spinner = $state<HTMLDivElement | null>(null);
  let layer = $state<HTMLDivElement | null>(null);
  let leftArc = $state<HTMLDivElement | null>(null);
  let rightArc = $state<HTMLDivElement | null>(null);
  let held: SpinnerHold | null = null;

  const angleOf = (node: Element) => {
    const matrix = new DOMMatrix(getComputedStyle(node).transform);
    return Math.atan2(matrix.b, matrix.a) * DEGREES;
  };

  $effect(() => {
    const current = hold;
    const last = held;
    if (!frame || !spinner || !layer || !leftArc || !rightArc || (!current && !last)) return;
    const turns = [spinner, layer].flatMap((node) => node.getAnimations());
    const arcs = [leftArc, rightArc].flatMap((node) => node.getAnimations());
    const duration = arcs[0]?.effect?.getTiming().duration;
    const reach = (typeof duration === "number" ? duration : 0) / HALF;
    if (current) {
      for (const animation of [...turns, ...arcs]) animation.pause();
      for (const animation of turns) animation.currentTime = 0;
      for (const animation of arcs) animation.currentTime = current.sweep * reach;
      frame.style.transform = `rotate(${current.turn}deg)`;
      held = current;
      return;
    }
    if (!last) return;
    held = null;
    for (const animation of [...turns, ...arcs]) {
      animation.currentTime = last.sweep * reach;
      animation.play();
    }
    frame.style.transform = `rotate(${last.turn - angleOf(spinner) - angleOf(layer)}deg)`;
  });
</script>

{#snippet ring(start: number | null)}
  <svg viewBox="0 0 {size} {size}">
    <circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={start === null ? undefined : dash}
      transform={start === null ? undefined : `rotate(${start} ${center} ${center})`}
    />
  </svg>
{/snippet}

<div class="flex items-center justify-center {className}">
  <div bind:this={frame} class="shrink-0 text-accent" style="width: {size}px; height: {size}px" aria-hidden="true">
    <div bind:this={spinner} class="spinner h-full">
      <div bind:this={layer} class="spinner-layer">
        <div class="spinner-half"><div bind:this={leftArc}>{@render ring(LEFT_START)}</div></div>
        <div class="spinner-half"><div bind:this={rightArc}>{@render ring(RIGHT_START + capDegrees)}</div></div>
        <div class="spinner-patch"><div>{@render ring(null)}</div></div>
      </div>
    </div>
  </div>
</div>
