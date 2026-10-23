<script lang="ts">
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";
  import PenLine from "@lucide/svelte/icons/pen-line";
  import type { SuggestionItem, SuggestionPicker } from "$lib/markdown/cconnectBlock";
  import { OUTLINE_CLASS } from "./Button.svelte";

  interface Props {
    items: SuggestionItem[];
    onSelect?: SuggestionPicker | null;
    class?: string;
  }

  const { items, onSelect = null, class: className = "" }: Props = $props();
</script>

<div class="flex w-full flex-wrap gap-1.5 {className}">
  {#each items as item (item.text)}
    <button
      type="button"
      disabled={!onSelect || (item.mode === "send" && !onSelect.sends)}
      onclick={() => onSelect?.pick(item)}
      class="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full {OUTLINE_CLASS} px-3 py-1 text-left text-body-sm transition-colors select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none enabled:hover:bg-hover disabled:cursor-default disabled:opacity-40"
    >
      {#if item.mode === "draft"}
        <PenLine size={14} class="shrink-0 text-accent" />
      {:else}
        <CornerDownRight size={14} class="shrink-0 text-accent" />
      {/if}
      <span class="min-w-0 truncate">{item.text}</span>
    </button>
  {/each}
</div>
