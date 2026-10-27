<script lang="ts">
  import type { Snippet } from "svelte";
  import { keepFocus } from "$lib/ui/keepFocus";
  import TooltipWrap from "$lib/ui/TooltipWrap.svelte";
  import { CHIP_SLOT, chipToggleClass } from "./toolbarChips";

  interface Props {
    label: string;
    pressed?: boolean;
    tinted?: boolean;
    class?: string;
    onclick: () => void;
    children: Snippet;
  }

  const { label, pressed = false, tinted = true, class: className = CHIP_SLOT, onclick, children }: Props = $props();
</script>

<TooltipWrap {label} class={className}>
  <button
    type="button"
    use:keepFocus
    {onclick}
    aria-label={label}
    aria-pressed={pressed}
    class={chipToggleClass(pressed && tinted)}
  >
    {@render children()}
  </button>
</TooltipWrap>
