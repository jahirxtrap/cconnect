<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import { gridHeight } from "./pixelGrid";

  interface Props {
    label: string;
    open: boolean;
    marked?: boolean;
    onToggle: (header: HTMLElement) => void;
    children: Snippet;
  }

  const { label, open, marked = false, onToggle, children }: Props = $props();
</script>

<div class="chat-gap flex w-full flex-col">
  <button
    type="button"
    onclick={(event) => onToggle(event.currentTarget)}
    class="flex w-full cursor-pointer items-center gap-1.5 rounded-sm py-1 text-left transition-colors select-none hover:bg-on-surface/8"
  >
    {#if open}
      <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
    {:else}
      <ChevronRight size={16} class="shrink-0 text-on-surface-variant" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">
      {label}{#if marked}<span class="text-error">&nbsp;*</span>{/if}
    </span>
  </button>
  {#if open}
    <div use:gridHeight class="chat-gap flex flex-col">{@render children()}</div>
  {/if}
</div>
