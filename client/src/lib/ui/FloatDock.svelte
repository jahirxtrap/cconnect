<script lang="ts">
  import { Portal } from "bits-ui";
  import type { Snippet } from "svelte";
  import { layout, MENU_GAP } from "$lib/platform/layout.svelte";
  import { snapToDevicePixel } from "./gridHeight";
  import { borderWidth, scrollableUnder, scrollbarWidth } from "./scrollbar";

  interface Props {
    stacked?: boolean;
    children: Snippet;
  }

  const { stacked = false, children }: Props = $props();

  const HALF = 2;

  const id = crypto.randomUUID();

  let scrollbar = $state(0);
  let contentHeight = $state(0);

  const bottom = $derived(
    stacked && layout.transfersInset
      ? layout.transfersInset + MENU_GAP
      : layout.menuPadding.bottom + layout.bottomInset,
  );

  $effect(() => {
    layout.docks[id] = contentHeight + bottom;
    return () => delete layout.docks[id];
  });

  $effect(() => {
    void [layout.width, layout.height, layout.rightInset];
    let tracked: HTMLElement | null = null;
    let border = 0;
    let frame = 0;
    const measure = () => {
      if (!tracked?.isConnected) {
        tracked = scrollableUnder(layout.width - layout.safeRight - layout.rightInset - 1, layout.height / HALF);
        border = tracked ? borderWidth(tracked) : 0;
      }
      scrollbar = tracked ? scrollbarWidth(tracked, border) : 0;
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  });
</script>

<Portal>
  <div
    style="padding: {snapToDevicePixel(layout.menuPadding.top)}px {snapToDevicePixel(
      layout.menuPadding.right + scrollbar + layout.rightInset,
    )}px {snapToDevicePixel(bottom)}px {snapToDevicePixel(layout.menuPadding.left + layout.leftInset)}px; --float-panel-width: {layout.mobile
      ? '100%'
      : 'calc(var(--spacing) * 90)'}"
    class="pointer-events-none fixed inset-x-0 bottom-0 z-30 {layout.insetsAnimated
      ? 'transition-[padding] duration-200'
      : ''}"
  >
    <div bind:clientHeight={contentHeight} class="flex flex-col items-end gap-1.5">
      {@render children()}
    </div>
  </div>
</Portal>
