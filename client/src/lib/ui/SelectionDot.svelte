<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  interface Props {
    selected: boolean;
    multi?: boolean;
    size?: number;
  }

  const { selected, multi = false, size = 20 }: Props = $props();

  const INNER = 0.5;
  const BORDER = 2;
</script>

<span
  style="width: {size}px; height: {size}px; border-width: {BORDER}px"
  class="flex shrink-0 items-center justify-center transition-colors {multi
    ? 'rounded-sm'
    : 'rounded-full'} {selected ? 'border-accent' : 'border-outline'}"
>
  {#if multi}
    {#if selected}
      <Check size={Math.round(size * 0.65)} class="text-accent" />
    {/if}
  {:else}
    <span
      style="width: {Math.round(size * INNER)}px; height: {Math.round(size * INNER)}px"
      class="rounded-full bg-accent transition-transform {selected ? 'scale-100' : 'scale-0'}"
    ></span>
  {/if}
</span>
