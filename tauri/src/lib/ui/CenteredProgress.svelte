<script lang="ts">
  interface Props {
    size?: number;
    stroke?: number;
    class?: string;
  }

  const { size = 32, stroke = 4, class: className = "" }: Props = $props();

  const radius = $derived((size - stroke) / 2);
  const circumference = $derived(2 * Math.PI * radius);
</script>

<div class="flex items-center justify-center {className}">
  <svg
    width={size}
    height={size}
    viewBox="0 0 {size} {size}"
    class="spinner shrink-0 text-accent"
    aria-hidden="true"
  >
    <circle
      cx={size / 2}
      cy={size / 2}
      r={radius}
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      style="--spinner-length: {circumference}px"
    />
  </svg>
</div>
