<script lang="ts">
  import { useShortcut } from "$lib/platform/useShortcut.svelte";

  interface Props {
    options: string[];
    selected: number;
    onSelect: (index: number) => void;
    counts?: (number | null)[];
    fill?: boolean;
    shortcuts?: boolean;
    class?: string;
  }

  const {
    options,
    selected,
    onSelect,
    counts = [],
    fill = false,
    shortcuts = true,
    class: className = "",
  }: Props = $props();

  const ARROW_KEYS: Record<string, (index: number, total: number) => number> = {
    ArrowRight: (index, total) => (index + 1) % total,
    ArrowLeft: (index, total) => (index - 1 + total) % total,
    Home: () => 0,
    End: (_index, total) => total - 1,
  };

  const buttons = $state<HTMLButtonElement[]>([]);

  const step = (delta: number) => onSelect((selected + delta + options.length) % options.length);

  const onKeydown = (event: KeyboardEvent) => {
    const next = ARROW_KEYS[event.key]?.(selected, options.length);
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    buttons[next]?.focus();
  };

  useShortcut("view.tab.next", () => step(1), () => shortcuts);
  useShortcut("view.tab.previous", () => step(-1), () => shortcuts);
</script>

<div
  class="{fill ? 'flex w-full' : 'inline-flex'} shrink-0 gap-0.5 rounded-full bg-surface-variant p-0.5 {className}"
  role="tablist"
  tabindex="-1"
  data-press="off"
  onkeydown={onKeydown}
>
  {#each options as option, index (option)}
    {@const count = counts[index] ?? null}
    <button
      bind:this={buttons[index]}
      type="button"
      role="tab"
      aria-selected={index === selected}
      tabindex={index === selected ? 0 : -1}
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
