<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "filled" | "outlined" | "ghost" | "text";

  interface Props {
    onclick: () => void;
    variant?: Variant;
    enabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const { onclick, variant = "filled", enabled = true, class: className = "", children }: Props = $props();

  const VARIANTS: Record<Variant, string> = {
    filled: "bg-accent text-on-accent enabled:hover:opacity-90",
    outlined: "border border-outline-variant enabled:hover:bg-on-surface/8",
    ghost: "enabled:hover:bg-on-surface/8",
    text: "text-on-surface-variant enabled:hover:text-on-surface",
  };
</script>

<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm px-3 text-label-lg whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 {VARIANTS[
    variant
  ]} {className}"
>
  {@render children()}
</button>
