<script lang="ts">
  import { chatBackground } from "$lib/data/chatBackground.svelte";
  import type { BackgroundArt, BackgroundEffects } from "$lib/design/backgrounds";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { devicePixels, scaledUrl } from "$lib/services/imageSize";
  import LogoGlyph from "$lib/ui/LogoGlyph.svelte";

  interface Props {
    id: string;
    effects: BackgroundEffects;
    file?: Blob | null;
    thumbnail?: boolean;
    class?: string;
  }

  const { id, effects, file = null, thumbnail = false, class: className = "" }: Props = $props();

  const PERCENT = 100;
  const BLEED_PER_BLUR = 2;

  let loaded = $state<string | null>(null);
  let width = $state(0);
  let height = $state(0);
  let own = $state<string | null>(null);

  const bleed = $derived(effects.blur * BLEED_PER_BLUR);
  const pixels = $derived(thumbnail && width && height ? devicePixels(Math.max(width, height) + bleed * 2) : 0);

  const wanted = $derived(thumbnail ? pixels : undefined);
  const measured = $derived(!thumbnail || pixels > 0);

  $effect(() => {
    if (!file && measured) chatBackground.loadImage(id, wanted);
  });

  $effect(() => {
    if (!file || !measured) return;
    return scaledUrl(file, wanted ?? null, (made) => (own = made));
  });

  const art = $derived(packs.backgroundOf(id)?.file === null ? (id as BackgroundArt) : null);
  const url = $derived(file ? own : measured ? chatBackground.imageOf(id, wanted) : null);
  const shown = $derived(art === "logo" || (url !== null && loaded === url));
  const filter = $derived(
    [
      effects.brightness !== PERCENT && `brightness(${effects.brightness / PERCENT})`,
      effects.saturation !== PERCENT && `saturate(${effects.saturation / PERCENT})`,
      effects.blur > 0 && `blur(${effects.blur}px)`,
    ]
      .filter(Boolean)
      .join(" ") || "none",
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
  bind:clientWidth={width}
  bind:clientHeight={height}
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
