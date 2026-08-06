<script lang="ts">
  import Square from "@lucide/svelte/icons/square";
  import SquareCheckBig from "@lucide/svelte/icons/square-check-big";

  interface Props {
    selected: boolean;
    size?: number;
  }

  const { selected, size = 20 }: Props = $props();
</script>

{#if selected}
  <SquareCheckBig {size} class="shrink-0 text-accent" />
{:else}
  <Square {size} class="shrink-0 text-on-surface-variant" />
{/if}
