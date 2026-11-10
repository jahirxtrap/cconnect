<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { keepEnd } from "./keepEnd";
  import { CARD_SCROLL_CLASS, viewportScrollbar } from "./scrollbar";
  import { rememberScroll } from "./scrollMemory";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    scroller?: HTMLDivElement | null;
    memory?: string | null;
    frame?: string;
    children: Snippet;
  }

  let {
    scroller = $bindable(null),
    memory = null,
    frame = "",
    class: className = "",
    children,
    ...rest
  }: Props = $props();

  $effect(() => {
    if (memory && scroller) return rememberScroll(scroller, memory);
  });
</script>

<div class="flex min-h-0 flex-col overflow-hidden bg-card {frame}">
  <div bind:this={scroller} use:viewportScrollbar use:keepEnd {...rest} class="{CARD_SCROLL_CLASS} {className}">
    {@render children()}
  </div>
</div>
