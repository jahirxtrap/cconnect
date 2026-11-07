<script lang="ts" module>
  export const BAR_ACTION_CLASS = "size-7";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    children?: Snippet;
  }

  const { label, children }: Props = $props();
</script>

<div class="flex min-h-10 shrink-0 items-center gap-1 rounded-panel bg-card py-1 pr-1.5 pl-3">
  <span class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">{label}</span>
  {@render children?.()}
</div>
