<script lang="ts" module>
  export const TILE_ICON_SIZE = 20;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { devicePixels } from "$lib/services/imageSize";
  import type { IconSource } from "./icons";

  interface Props {
    icon?: IconSource;
    src?: string | null;
    pixels?: number;
    class?: string;
    children?: Snippet;
  }

  let { icon: IconComponent, src = null, pixels = $bindable(0), class: className = "", children }: Props = $props();

  const TILE_CLASS = "size-11 shrink-0 rounded-lg";

  let width = $state(0);

  $effect(() => {
    pixels = devicePixels(width);
  });
</script>

{#if src}
  <img bind:clientWidth={width} {src} alt="" draggable="false" class="{TILE_CLASS} object-cover {className}" />
{:else}
  <span
    bind:clientWidth={width}
    class="flex {TILE_CLASS} items-center justify-center bg-surface-variant text-on-surface-variant {className}"
  >
    {#if children}
      {@render children()}
    {:else if IconComponent}
      <IconComponent size={TILE_ICON_SIZE} />
    {/if}
  </span>
{/if}
