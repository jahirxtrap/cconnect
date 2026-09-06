<script lang="ts">
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";

  interface Props {
    items: string[];
    onSelect?: ((text: string) => void) | null;
    class?: string;
  }

  const { items, onSelect = null, class: className = "" }: Props = $props();
</script>

<div class="flex w-full flex-wrap gap-1.5 {className}">
  {#each items as item (item)}
    <button
      type="button"
      disabled={!onSelect}
      onclick={() => onSelect?.(item)}
      class="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full border-2 border-outline-variant px-3 py-1 text-left text-body-sm transition-colors select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40"
    >
      <CornerDownRight size={14} class="shrink-0 text-on-surface-variant" />
      <span class="min-w-0 truncate">{item}</span>
    </button>
  {/each}
</div>
