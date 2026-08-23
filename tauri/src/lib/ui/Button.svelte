<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "filled" | "outlined" | "ghost" | "text" | "accent";

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
    outlined: "border-2 border-outline-variant enabled:hover:bg-on-surface/8",
    ghost: "enabled:hover:bg-on-surface/8",
    text: "text-on-surface-variant enabled:hover:text-on-surface",
    accent: "text-accent enabled:hover:bg-accent/10",
  };
</script>

<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-label-lg whitespace-nowrap transition-colors select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 {VARIANTS[
    variant
  ]} {className}"
>
  {@render children()}
</button>
