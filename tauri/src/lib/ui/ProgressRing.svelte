<script lang="ts">
  interface Props {
    value: number;
    pending?: number;
    size?: number;
    stroke?: number;
    class?: string;
    trackClass?: string | null;
    pendingClass?: string;
  }

  const {
    value,
    pending = 0,
    size = 16,
    stroke = 2,
    class: className = "text-accent",
    trackClass = null,
    pendingClass = "text-on-surface-variant",
  }: Props = $props();

  const TRACK_OPACITY = 0.25;
  const QUARTER_TURN = -90;
  const FULL_TURN = 360;

  const clamp = (input: number) => Math.min(1, Math.max(0, input));

  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
  const progress = $derived(clamp(value));
  const queued = $derived(clamp(pending));
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" class="shrink-0 {className}" aria-hidden="true">
  <circle
    cx={size / 2}
    cy={size / 2}
    r={radius}
    fill="none"
    stroke="currentColor"
    stroke-width={stroke}
    transform="rotate({QUARTER_TURN} {size / 2} {size / 2})"
    class={trackClass}
    opacity={trackClass ? undefined : TRACK_OPACITY}
  />
  {#if queued > 0}
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={circumference}
      stroke-dashoffset={circumference * (1 - queued)}
      transform="rotate({QUARTER_TURN + FULL_TURN * progress} {size / 2} {size / 2})"
      class={pendingClass}
    />
  {/if}
  {#if progress > 0}
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
  {/if}
</svg>
