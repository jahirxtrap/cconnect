<script lang="ts">
  import { useShortcut } from "$lib/platform/useShortcut.svelte";

  interface Props {
    options: string[];
    selected: number;
    onSelect: (index: number) => void;
    counts?: (number | null)[];
    fill?: boolean;
    class?: string;
  }

  const { options, selected, onSelect, counts = [], fill = false, class: className = "" }: Props = $props();

  const step = (delta: number) => onSelect((selected + delta + options.length) % options.length);

  useShortcut("view.tab.next", () => step(1));
  useShortcut("view.tab.previous", () => step(-1));
</script>

<div
  class="{fill ? 'flex w-full' : 'inline-flex'} shrink-0 gap-0.5 rounded-full bg-surface-variant p-0.5 {className}"
  role="tablist"
  data-press="off"
>
  {#each options as option, index (option)}
    {@const count = counts[index] ?? null}
    <button
      type="button"
      role="tab"
      aria-selected={index === selected}
      onclick={() => onSelect(index)}
      class="inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-body-sm whitespace-nowrap transition-colors select-none {fill
        ? 'flex-1'
        : ''} {index === selected
        ? 'bg-outline-variant text-on-surface'
        : 'text-on-surface-variant hover:text-on-surface active:text-on-surface'}"
    >
      <span class="truncate">{option}</span>
      {#if count !== null}
        <span class="text-caption">{count}</span>
      {/if}
    </button>
  {/each}
</div>
