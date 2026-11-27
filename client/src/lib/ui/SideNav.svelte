<script lang="ts">
  import type { Snippet } from "svelte";
  import { viewportScrollbar } from "./scrollbar";

  interface Props {
    children: Snippet;
  }

  const { children }: Props = $props();
</script>

<div class="flex min-h-0 w-52 shrink-0 flex-col pb-(--page-inset)">
  <nav class="flex max-h-full min-h-0 flex-col overflow-hidden rounded-panel bg-card">
    <div
      use:viewportScrollbar
      class="scrollbar-thin rounded-viewport flex min-h-0 flex-col gap-px overflow-y-auto p-1 [--viewport-inset:0px]"
    >
      {@render children()}
    </div>
  </nav>
</div>
