<script lang="ts">
  import type { Snippet } from "svelte";
  import { SECTION_LABEL_CLASS } from "./sectionLabel";

  interface Props {
    label?: string | null;
    labelTrailing?: Snippet;
    children: Snippet;
  }

  const { label, labelTrailing, children }: Props = $props();
</script>

<div class="w-full">
  {#if label}
    <div class="flex h-9 items-center gap-2 px-1">
      <p class="min-w-0 flex-1 {SECTION_LABEL_CLASS}">{label}</p>
      {@render labelTrailing?.()}
    </div>
  {:else}
    <div class="h-4"></div>
  {/if}
  <div class="flex w-full flex-col overflow-hidden rounded-lg bg-card p-1">
    {@render children()}
  </div>
</div>
