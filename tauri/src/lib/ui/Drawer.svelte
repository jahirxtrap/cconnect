<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    onDismiss: () => void;
    width?: number;
    children: Snippet;
  }

  const { open, onDismiss, width = 300, children }: Props = $props();
</script>

{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/40"
    role="presentation"
    onclick={onDismiss}
    onkeydown={(event) => event.key === "Escape" && onDismiss()}
  ></div>
{/if}
<aside
  class="fixed inset-y-0 left-0 z-40 transition-transform duration-200 {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
  style="width: {width}px"
>
  {@render children()}
</aside>
