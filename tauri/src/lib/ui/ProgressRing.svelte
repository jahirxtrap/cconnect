<script lang="ts">
  interface Props {
    value: number;
    size?: number;
    stroke?: number;
    class?: string;
  }

  const { value, size = 16, stroke = 2, class: className = "text-accent" }: Props = $props();

  const TRACK_OPACITY = 0.25;
  const QUARTER_TURN = -90;

  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const progress = $derived(Math.min(1, Math.max(0, value)));
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0 {className}" aria-hidden="true">
  <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    opacity={TRACK_OPACITY}
  />
  <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    stroke-linecap="round"
    stroke-dasharray={circumference}
    stroke-dashoffset={circumference * (1 - progress)}
    transform="rotate({QUARTER_TURN} {size / 2} {size / 2})"
  />
</svg>
