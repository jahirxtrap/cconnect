<script lang="ts" module>
  export const TILE_ICON_SIZE = 20;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";

  interface Props {
    icon?: IconSource;
    class?: string;
    children?: Snippet;
  }

  const { icon: IconComponent, class: className = "", children }: Props = $props();
</script>

<span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-on-surface-variant {className}">
  {#if children}
    {@render children()}
  {:else if IconComponent}
    <IconComponent size={TILE_ICON_SIZE} />
  {/if}
</span>
