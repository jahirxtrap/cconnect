<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "text" | "filled" | "outlined";

  interface Props {
    onclick: () => void;
    variant?: Variant;
    enabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const { onclick, variant = "text", enabled = true, class: className = "", children }: Props = $props();

  const VARIANTS: Record<Variant, string> = {
    text: "px-3 text-accent enabled:hover:bg-accent/8",
    filled: "px-6 bg-accent text-on-accent enabled:hover:brightness-110",
    outlined: "px-6 border border-outline text-accent enabled:hover:bg-accent/8",
  };
</script>

<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full text-label-lg whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-40 {VARIANTS[variant]} {className}"
>
  {@render children()}
</button>
