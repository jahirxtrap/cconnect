<script lang="ts">
  import type { Snippet } from "svelte";
  import { hscrollbar } from "$lib/ui/scrollbar";
  import PaneViewMenu from "./PaneViewMenu.svelte";

  interface Props {
    actions?: Snippet;
  }

  const { actions }: Props = $props();
</script>

<div class="flex min-w-0 shrink items-center">
  {#if actions}
    <div
      use:hscrollbar={{ wheel: true }}
      class="no-scrollbar flex min-w-0 items-center overflow-x-auto"
    >
      {@render actions()}
    </div>
    <span class="mx-1 h-5 w-px shrink-0 bg-outline-variant"></span>
  {/if}
  <PaneViewMenu />
</div>
