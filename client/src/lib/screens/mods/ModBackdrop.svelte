<script lang="ts">
  import type { ModGround } from "$lib/data/modModels";
  import { artBleed, artFrame, type BackgroundEffects } from "$lib/design/backgrounds";
  import { theme } from "$lib/design/theme.svelte";
  import { imageCache } from "$lib/services/imageCache.svelte";
  import { screenPixels, vectorBlob } from "$lib/services/imageSize";
  import { groundColor, lookScheme } from "./lookColors";
  import type { ModSurface } from "./modSurface.svelte";
  import { svgFit, svgSource } from "./modStyle";

  interface Props {
    mods: ModSurface;
    effects: BackgroundEffects;
    still?: boolean;
    class?: string;
  }

  const { mods, effects, still = false, class: className = "" }: Props = $props();

  const PERCENT = 100;
  const SCENE_KEY = "mod-scene:";
  const patternId = $props.id();

  const look = $derived(mods.look);
  const scheme = $derived(lookScheme(look, theme.dark));
  const scene = $derived(look?.scene ?? null);
  const ground = $derived(scene ? null : (look?.ground ?? null));
  const frame = $derived(artFrame(effects));
  const stillKey = $derived(still && scene ? `${SCENE_KEY}${scene.source}` : null);
  const stillPixels = $derived(screenPixels(artBleed(effects)));
  const sceneUrl = $derived(stillKey ? imageCache.get(stillKey, stillPixels) : scene ? svgSource(scene.source) : null);
  const sceneFit = $derived(stillKey && scene ? svgFit(scene.source) : "");

  $effect(() => {
    const key = stillKey;
    const source = scene?.source;
    if (key && source) imageCache.load(key, async () => vectorBlob(source), stillPixels);
  });

  let image = $state<string | null>(null);

  $effect(() => {
    const picture = ground?.kind === "image" ? ground : null;
    image = null;
    if (!picture) return;
    let active = true;
    void mods.image(picture.id, picture.type).then((url) => {
      if (active) image = url;
    });
    return () => {
      active = false;
    };
  });

  const color = (value: string | null): string => (value && look ? groundColor(value, look, scheme) : null) ?? "transparent";

  const tiling = (tile: [number, number] | null): string =>
    tile ? `background-size: ${tile[0]}px ${tile[1]}px; background-repeat: repeat` : "background-size: 100% 100%; background-repeat: no-repeat";

  const gradientStyle = (gradient: Extract<ModGround, { kind: "gradient" }>): string => {
    const stops = gradient.stops
      .map((stop) => (stop.at === null ? color(stop.color) : `${color(stop.color)} ${stop.at * PERCENT}%`))
      .join(", ");
    const paint = gradient.radial ? `radial-gradient(ellipse at center, ${stops})` : `linear-gradient(${gradient.angle}deg, ${stops})`;
    return `background-image: ${paint}; ${tiling(gradient.repeat ? gradient.size : null)}`;
  };
</script>

{#snippet paths(vector: Extract<ModGround, { kind: "vector" }>)}
  {#each vector.paths as path, index (index)}
    {#if path.strokeWidth === null}
      <path d={path.d} fill={color(path.color ?? vector.color)} fill-rule="evenodd" />
    {:else}
      <path
        d={path.d}
        fill="none"
        stroke={color(path.color ?? vector.color)}
        stroke-width={path.strokeWidth}
        vector-effect="non-scaling-stroke"
      />
    {/if}
  {/each}
{/snippet}

<div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden {className}">
  <div class="absolute" style={frame}>
    {#if scene}
      {#if sceneUrl}
        <img src={sceneUrl} alt="" draggable="false" class="absolute inset-0 size-full max-w-none select-none" style={sceneFit} />
      {/if}
    {:else if ground?.kind === "color"}
      <div class="absolute inset-0" style="background-color: {color(ground.color)}"></div>
    {:else if ground?.kind === "gradient"}
      <div class="absolute inset-0" style={gradientStyle(ground)}></div>
    {:else if ground?.kind === "vector"}
      {@const [width, height] = ground.viewBox}
      {#if ground.repeat}
        {@const [tileWidth, tileHeight] = ground.size ?? ground.viewBox}
        <svg class="absolute inset-0 size-full">
          <defs>
            <pattern
              id={patternId}
              width={tileWidth}
              height={tileHeight}
              patternUnits="userSpaceOnUse"
              viewBox="0 0 {width} {height}"
              preserveAspectRatio="none"
            >
              {@render paths(ground)}
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#{patternId})" />
        </svg>
      {:else if ground.size}
        <svg class="absolute inset-0 m-auto" width={ground.size[0]} height={ground.size[1]} viewBox="0 0 {width} {height}" preserveAspectRatio="none">
          {@render paths(ground)}
        </svg>
      {:else}
        <svg class="absolute inset-0 size-full" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
          {@render paths(ground)}
        </svg>
      {/if}
    {:else if ground?.kind === "image" && image}
      {#if ground.repeat}
        <div class="absolute inset-0" style="background-image: url({image}); {tiling(ground.size ?? [ground.width, ground.height])}"></div>
      {:else}
        <img src={image} alt="" draggable="false" class="absolute inset-0 size-full max-w-none object-cover object-center select-none" />
      {/if}
    {/if}
  </div>
</div>
