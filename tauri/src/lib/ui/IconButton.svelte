<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    onclick: () => void;
    enabled?: boolean;
    title?: string;
    class?: string;
    children: Snippet;
  }

  const { onclick, enabled = true, title, class: className = "", children }: Props = $props();
</script>

<button
  type="button"
  disabled={!enabled}
  {title}
  aria-label={title}
  {onclick}
  class="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40 {className}"
>
  {@render children()}
</button>
