<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  interface Props {
    items: readonly T[];
    keyOf: (item: T) => string;
    selected: string | null;
    cell: number;
    gap: number;
    rows?: number;
    stretch?: boolean;
    item: Snippet<[T]>;
    more: Snippet<[expanded: boolean, hidden: number, toggle: () => void]>;
  }

  const { items, keyOf, selected, cell, gap, rows = 1, stretch = false, item, more }: Props = $props();

  const MIN_COLUMNS = 2;

  let width = $state(0);
  let expanded = $state(false);

  const columns = $derived(Math.max(MIN_COLUMNS, Math.floor((width + gap) / (cell + gap))));
  const capacity = $derived(columns * rows);
  const folds = $derived(items.length > capacity);

  const shown = $derived.by(() => {
    if (expanded || !folds) return items;
    const first = items.slice(0, capacity - 1);
    if (selected === null || first.some((entry) => keyOf(entry) === selected)) return first;
    const chosen = items.find((entry) => keyOf(entry) === selected);
    return chosen ? [...first.slice(0, -1), chosen] : first;
  });
</script>

<div
  bind:clientWidth={width}
  style="grid-template-columns: repeat({columns}, {stretch ? 'minmax(0, 1fr)' : `${cell}px`}); gap: {gap}px"
  class="grid"
>
  {#each shown as entry (keyOf(entry))}
    {@render item(entry)}
  {/each}
  {#if folds}
    {@render more(expanded, items.length - shown.length, () => (expanded = !expanded))}
  {/if}
</div>
