<script lang="ts">
  interface Props {
    size?: number;
    stroke?: number;
    class?: string;
  }

  const { size = 32, stroke = 4, class: className = "" }: Props = $props();

  const LEFT_START = 135;
  const RIGHT_START = 225;

  const center = $derived(size / 2);
  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const capDegrees = $derived((stroke / radius) * (180 / Math.PI));
  const dash = $derived(`${circumference / 2 - stroke} ${circumference}`);
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
  <div class="spinner shrink-0 text-accent" style="width: {size}px; height: {size}px" aria-hidden="true">
    <div class="spinner-layer">
      <div class="spinner-half"><div>{@render ring(LEFT_START)}</div></div>
      <div class="spinner-half"><div>{@render ring(RIGHT_START + capDegrees)}</div></div>
      <div class="spinner-patch"><div>{@render ring(null)}</div></div>
    </div>
  </div>
</div>
