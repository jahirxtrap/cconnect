<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  interface Props {
    selected: boolean;
    multi?: boolean;
    size?: number;
  }

  const { selected, multi = false, size = 20 }: Props = $props();

  const BOX = 20;
  const STROKE = 2;
  const DOT = 5;
</script>

{#if multi}
  <span
    style="width: {size}px; height: {size}px; border-width: {STROKE}px"
    class="flex shrink-0 items-center justify-center rounded-sm transition-colors {selected
      ? 'border-accent'
      : 'border-outline'}"
  >
    {#if selected}
      <Check size={Math.round(size * 0.65)} class="text-accent" />
    {/if}
  </span>
{:else}
  <svg
    width={size}
    height={size}
    viewBox="0 0 {BOX} {BOX}"
    class="shrink-0"
    aria-hidden="true"
  >
    <circle
      cx={BOX / 2}
      cy={BOX / 2}
      r={(BOX - STROKE * 1.5) / 2}
      fill="none"
      stroke-width={STROKE}
      class="transition-colors {selected ? 'stroke-accent' : 'stroke-outline'}"
    />
    <circle
      cx={BOX / 2}
      cy={BOX / 2}
      r={DOT}
      style="transform-box: fill-box; transform-origin: center"
      class="fill-accent transition-transform {selected ? 'scale-100' : 'scale-0'}"
    />
  </svg>
{/if}
