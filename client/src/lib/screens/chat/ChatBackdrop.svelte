<script lang="ts">
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import type { BackgroundArt, BackgroundEffects } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { dialogSettled } from "$lib/ui/dialogSettled";
  import LogoGlyph from "$lib/ui/LogoGlyph.svelte";

  interface Props {
    id: string;
    effects: BackgroundEffects;
    src?: string | null;
    class?: string;
  }

  const { id, effects, src = null, class: className = "" }: Props = $props();

  const PERCENT = 100;
  const BLEED_PER_BLUR = 2;

  const settled = dialogSettled();

  let loaded = $state<string | null>(null);

  $effect(() => {
    if (!src && settled()) void chatBackground.ensure(id);
  });

  const art = $derived(packs.backgroundOf(id)?.file === null ? (id as BackgroundArt) : null);
  const url = $derived(settled() ? (src ?? chatBackground.urls[id] ?? null) : null);
  const shown = $derived(art === "logo" || (url !== null && loaded === url));
  const bleed = $derived(effects.blur * BLEED_PER_BLUR);
  const filter = $derived(
    `brightness(${effects.brightness / PERCENT}) saturate(${effects.saturation / PERCENT}) blur(${effects.blur}px)`,
  );
  const frame = $derived(
    `left: -${bleed}px; top: -${bleed}px; width: calc(100% + ${bleed * 2}px); height: calc(100% + ${bleed * 2}px); opacity: ${effects.opacity / PERCENT}; filter: ${filter}`,
  );

  const cached = (image: HTMLImageElement) => {
    if (image.complete && image.naturalWidth > 0) loaded = url;
  };
</script>

<div
  aria-hidden="true"
  class="pointer-events-none absolute inset-0 overflow-hidden {shown ? '' : 'opacity-0'} {className}"
>
  {#if art === "logo"}
    <div class="absolute flex items-center justify-center" style={frame}>
      <svg viewBox="0 0 108 108" class="size-[min(60%,24rem)]"><LogoGlyph ring="stroke-outline" mark="stroke-on-background" /></svg>
    </div>
  {:else if url}
    <img
      src={url}
      alt=""
      draggable="false"
      use:cached
      onload={() => (loaded = url)}
      class="absolute max-w-none select-none"
      style="{frame}; object-fit: {effects.fit}; object-position: {effects.x}% {effects.y}%"
    />
  {/if}
</div>
