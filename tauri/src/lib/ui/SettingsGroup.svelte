<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label?: string | null;
    labelTrailing?: Snippet;
    children: Snippet;
  }

  const { label, labelTrailing, children }: Props = $props();
</script>

<div class="w-full">
  {#if label}
    <div class="flex items-center px-4 py-2">
      <p class="min-w-0 flex-1 truncate text-label-lg text-accent">{label}</p>
      {@render labelTrailing?.()}
    </div>
  {:else}
    <div class="h-4"></div>
  {/if}
  <div class="w-full overflow-hidden rounded-group bg-surface-variant">
    {@render children()}
  </div>
</div>
