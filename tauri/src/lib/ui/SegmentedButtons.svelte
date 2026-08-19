<script lang="ts">
  interface Props {
    options: string[];
    selected: number;
    onSelect: (index: number) => void;
    class?: string;
  }

  const { options, selected, onSelect, class: className = "" }: Props = $props();
</script>

<div class="flex w-full {className}" role="tablist">
  {#each options as option, index (option)}
    <button
      type="button"
      role="tab"
      aria-selected={index === selected}
      onclick={() => onSelect(index)}
      class="min-w-0 flex-1 cursor-pointer truncate border-2 border-outline-variant px-3 py-1.5 text-label-lg transition-colors first:rounded-l-sm last:rounded-r-sm not-first:-ml-0.5 {index ===
      selected
        ? 'z-10 bg-accent/18 text-accent hover:bg-accent/25'
        : 'text-on-surface-variant hover:bg-on-surface/8'}"
    >
      {option}
    </button>
  {/each}
</div>
