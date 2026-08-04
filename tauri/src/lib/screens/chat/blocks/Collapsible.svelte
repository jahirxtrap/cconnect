<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";

  interface Props {
    label: string;
    icon?: IconSource;
    labelOnly?: boolean;
    running?: boolean;
    labelClass?: string;
    children?: Snippet;
  }

  const { label, icon: IconComponent, labelOnly = false, running = false, labelClass = "text-on-surface-variant", children }: Props = $props();

  let expanded = $state(false);
</script>

<div class="w-full px-4">
  <button
    type="button"
    disabled={labelOnly}
    onclick={() => (expanded = !expanded)}
    class="flex w-full items-center gap-1.5 text-left {labelOnly ? 'cursor-default' : 'cursor-pointer'}"
  >
    {#if IconComponent}
      <IconComponent size={16} class="shrink-0 text-accent" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-label-lg {labelClass}">{label}</span>
    {#if running}
      <span class="size-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
    {/if}
    {#if !labelOnly}
      {#if expanded}
        <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={16} class="shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  </button>
  {#if expanded && children}
    <div class="mt-1.5">{@render children()}</div>
  {/if}
</div>
