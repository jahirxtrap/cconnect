<script lang="ts">
  import { Portal } from "bits-ui";
  import type { Snippet } from "svelte";
  import { layout, MENU_GAP } from "$lib/platform/layout.svelte";
  import { dockSpot } from "./dockArea.svelte";
  import { snapToDevicePixel } from "./gridHeight";

  interface Props {
    stacked?: boolean;
    raised?: boolean;
    children: Snippet;
  }

  const { stacked = false, raised = false, children }: Props = $props();

  const id = crypto.randomUUID();

  let contentHeight = $state(0);

  const bottom = $derived(stacked && layout.transfersInset ? layout.transfersInset + MENU_GAP : dockSpot.bottom);

  $effect(() => {
    layout.docks[id] = contentHeight + bottom;
    return () => delete layout.docks[id];
  });
</script>

<Portal>
  <div
    style="padding: {snapToDevicePixel(layout.menuPadding.top)}px {snapToDevicePixel(dockSpot.right)}px {snapToDevicePixel(
      bottom,
    )}px {snapToDevicePixel(layout.menuPadding.left + layout.leftInset)}px; --float-panel-width: {layout.mobile
      ? '100%'
      : 'calc(var(--spacing) * 90)'}"
    class="pointer-events-none fixed inset-x-0 bottom-0 {raised ? 'z-50' : 'z-30'} {layout.insetsAnimated &&
    !dockSpot.anchored
      ? 'transition-[padding] duration-200'
      : ''}"
  >
    <div bind:clientHeight={contentHeight} class="flex flex-col items-end gap-1.5">
      {@render children()}
    </div>
  </div>
</Portal>
