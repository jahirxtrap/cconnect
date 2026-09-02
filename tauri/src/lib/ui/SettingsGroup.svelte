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
    <div class="flex h-9 items-center gap-2">
      <p class="min-w-0 flex-1 truncate text-label-md tracking-[0.6px] text-on-surface-variant uppercase">{label}</p>
      {@render labelTrailing?.()}
    </div>
  {:else}
    <div class="h-4"></div>
  {/if}
  <div
    class="w-full divide-y overflow-hidden rounded-group border-2 border-outline-variant bg-surface [&>*]:border-outline-variant"
  >
    {@render children()}
  </div>
</div>
