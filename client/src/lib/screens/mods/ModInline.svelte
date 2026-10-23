<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ModComponent } from "$lib/data/modModels";
  import { gridOf, gridStyle, provideGrid, ruleAxes } from "./modGrid";
  import ModTree from "./ModTree.svelte";
  import type { ModSurface } from "./modSurface.svelte";

  interface Props {
    mods: ModSurface;
    component: ModComponent;
    instanceId: string;
    props: Record<string, unknown>;
    engine: Snippet<[Record<string, unknown>]>;
    eager?: boolean;
    inset?: boolean;
    class?: string;
  }

  const {
    mods,
    component,
    instanceId,
    props,
    engine,
    eager = false,
    inset = false,
    class: className = "",
  }: Props = $props();

  const PROBE = "0000000000";

  let host = $state<HTMLElement | null>(null);
  let room = $state(0);
  let probe = $state<HTMLElement | null>(null);
  let probeWidth = $state(0);
  let lineHeight = $state(0);
  let entered = $state(false);
  const seen = $derived(eager || entered);

  const drawing = $derived(mods.drawing(component, instanceId));
  const axes = $derived(probeWidth ? ruleAxes(host, probe, lineHeight) : undefined);
  const grid = $derived(gridOf(room, probeWidth / PROBE.length, lineHeight, 0, axes));
  const columns = $derived(grid.columns);
  const shown = $derived(drawing?.props ?? props);
  const site = $derived({ component, instanceId });

  provideGrid(() => grid);

  $effect(() => {
    if (!host || seen) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      entered = true;
      observer.disconnect();
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!seen || !columns || !mods.state.surface) return;
    return mods.mount({ component, instanceId, props: $state.snapshot(props), columns, rows: 1, offset: 0 });
  });
</script>

{#snippet own()}{@render engine(shown)}{/snippet}

{#snippet bled()}<div class="-mx-(--page-inset)">{@render engine(shown)}</div>{/snippet}

<div
  bind:this={host}
  style={gridStyle(grid)}
  class="relative min-w-0 {className}"
>
  <span
    aria-hidden="true"
    bind:this={probe}
    bind:clientWidth={probeWidth}
    bind:clientHeight={lineHeight}
    class="pointer-events-none invisible absolute top-0 left-0 font-mono text-body-md whitespace-pre">{PROBE}</span
  >
  <div bind:clientWidth={room} class={inset ? "mx-(--page-inset)" : ""}>
    {#if drawing?.tree}
      <div class="text-body-md text-on-surface">
        <ModTree node={drawing.tree} {mods} {site} engine={inset ? bled : own} />
      </div>
    {:else}
      {@render (inset ? bled : own)()}
    {/if}
  </div>
</div>
