<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { CARD_SCROLL_CLASS, viewportScrollbar } from "./scrollbar";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    scroller?: HTMLDivElement | null;
    frame?: string;
    children: Snippet;
  }

  let { scroller = $bindable(null), frame = "", class: className = "", children, ...rest }: Props = $props();
</script>

<div class="flex min-h-0 flex-col overflow-hidden bg-card {frame}">
  <div bind:this={scroller} use:viewportScrollbar {...rest} class="{CARD_SCROLL_CLASS} {className}">
    {@render children()}
  </div>
</div>
