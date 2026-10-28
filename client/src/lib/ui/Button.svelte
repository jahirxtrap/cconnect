<script module lang="ts">
  export const OUTLINE_CLASS = "ring-(length:--hairline) ring-outline ring-inset";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  type Variant = "filled" | "destructive" | "outlined" | "danger" | "ghost" | "accent";

  interface Props {
    onclick: () => void;
    variant?: Variant;
    small?: boolean;
    enabled?: boolean;
    class?: string;
    children: Snippet;
  }

  const { onclick, variant = "filled", small = false, enabled = true, class: className = "", children }: Props = $props();

  const VARIANTS: Record<Variant, string> = {
    filled: "ripple bg-accent text-on-accent",
    destructive: "ripple bg-red text-on-accent",
    outlined: `text-on-surface ${OUTLINE_CLASS} enabled:hover:bg-hover`,
    danger: `text-red ${OUTLINE_CLASS} enabled:hover:bg-hover`,
    ghost: "text-on-surface enabled:hover:bg-hover",
    accent: "text-accent enabled:hover:bg-accent-soft",
  };
</script>

<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 {small
    ? 'h-7 gap-1.5 px-3 text-body-sm'
    : 'h-8 gap-2 px-4 text-body-md'} {VARIANTS[variant]} {className}"
>
  {@render children()}
</button>
