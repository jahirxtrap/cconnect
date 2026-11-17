<script lang="ts">
  import VeilBand from "../VeilBand.svelte";
  import { windowVeil } from "../windowVeil";

  interface Props {
    tint: string;
  }

  const { tint }: Props = $props();

  type Box = { left: number; top: number; width: number; height: number };

  const host = windowVeil();
  const veil = $derived(host?.veil() ?? null);

  let probe = $state<HTMLDivElement | null>(null);
  let anchor = $state<HTMLDivElement | null>(null);
  let strip = $state<Box | null>(null);
  let art = $state<Box | null>(null);
  let band = $state<Box | null>(null);

  const boxOf = (element: Element): Box => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top, width, height };
  };

  const within = (box: Box, from: Box): Box => ({ ...box, left: box.left - from.left, top: box.top - from.top });

  const place = (box: Box) => `left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px`;

  $effect(() => {
    const element = probe;
    const origin = anchor;
    const viewport = element?.closest("[data-chat-viewport]");
    const source = element?.closest("[data-art-host]")?.querySelector<HTMLElement>(":scope > [data-window-art]");
    const veiled = element?.closest("[data-veil-card]")?.querySelector<HTMLElement>("[data-veil-band]");
    if (!element || !origin || !viewport || !source) return;
    const measure = () => {
      const port = boxOf(viewport);
      strip = within({ ...port, height: boxOf(element).height }, boxOf(origin));
      art = within(boxOf(source), port);
      band = veiled ? within(boxOf(veiled), port) : null;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(viewport);
    observer.observe(source);
    if (veiled) observer.observe(veiled);
    return () => observer.disconnect();
  });
</script>

<div
  bind:this={probe}
  aria-hidden="true"
  class="pointer-events-none absolute inset-0 -z-10"
  style="clip-path: inset(0 round var(--radius-panel) var(--radius-panel) 0 0)"
>
  <div bind:this={anchor} class="fixed top-0 left-0"></div>
  {#if host && strip && art}
    <div class="fixed overflow-hidden" style={place(strip)}>
      <div class="absolute bg-background" style={place(art)}>
        {@render host.still()}
      </div>
      {#if veil && band}
        <div class="absolute" style={place(band)}>
          <VeilBand tint={veil.tint} opacity={veil.opacity} column={host.column()} />
        </div>
      {/if}
      <div class="absolute inset-0 {tint}"></div>
    </div>
  {/if}
</div>
