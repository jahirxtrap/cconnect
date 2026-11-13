<script lang="ts">
  import ImageOff from "@lucide/svelte/icons/image-off";
  import { visibleName } from "$lib/data/format";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { previewKindOf } from "$lib/data/previewKind";
  import { devicePixels, sizedImage } from "$lib/services/imageSize";
  import { imageSrc } from "$lib/services/mediaSource";
  import { fittedImageOf, videoStillOf } from "$lib/services/sharedApi";
  import AudioCard from "./AudioCard.svelte";
  import AudioCover from "./AudioCover.svelte";
  import CenteredProgress from "./CenteredProgress.svelte";
  import ExpandButton from "./ExpandButton.svelte";
  import { MEDIA_FRAME_CLASS } from "./mediaFrame";
  import MediaPlayer from "./MediaPlayer.svelte";
  import { nearView } from "./nearView";

  interface Props {
    url: string;
    alt: string;
    poster?: string;
    onOpen: (url: string, filename: string) => void;
    compact?: boolean;
    framed?: boolean;
  }

  const { url, alt, poster, onOpen, compact = false, framed = false }: Props = $props();

  const FRAME_ASPECT = 4 / 3;

  let status = $state<"loading" | "ready" | "error">("loading");
  let player = $state<MediaPlayer | null>(null);
  let near = $state(false);

  const resolved = $derived(url);

  const filename = $derived.by(() => {
    const raw = resolved.split(/[?#]/)[0].split("/").pop() ?? "";
    try {
      return visibleName(decodeURIComponent(raw) || "image");
    } catch {
      return visibleName(raw) || "image";
    }
  });

  const kind = $derived(previewKindOf(filename));
  const video = $derived(kind === "video");
  const audio = $derived(kind === "audio");
  const picture = $derived(!video && !audio);

  let frameHeight = $state(0);
  let stillMissing = $state(false);

  const served = $derived(poster || !video ? null : videoStillOf(resolved));
  const still = $derived(
    stillMissing
      ? undefined
      : poster || (served ? sizedImage(served, devicePixels(frameHeight)) : undefined),
  );
  const shownUrl = $derived(
    !picture || !frameHeight ? undefined : fittedImageOf(resolved, devicePixels(frameHeight * FRAME_ASPECT)),
  );

  $effect(() => {
    serverSettings.ensure();
  });
</script>

{#snippet cover()}
  <AudioCover url={resolved} class="h-full" />
{/snippet}

{#if audio && !framed}
  <AudioCard tracks={[{ url: resolved, name: filename, title: alt }]} {onOpen} />
{:else}
  <div
    use:nearView={() => (near = true)}
    bind:clientHeight={frameHeight}
    class="relative flex max-w-full shrink items-center justify-center overflow-hidden {MEDIA_FRAME_CLASS} bg-card select-none {compact
      ? 'h-40'
      : 'h-70'}"
    style:aspect-ratio={FRAME_ASPECT}
  >
    {#if video || audio}
      {#if audio}
        {#if near}
          <MediaPlayer bind:this={player} url={resolved} kind="audio" artwork={cover} class="size-full" />
        {/if}
      {:else if near && frameHeight && served !== undefined}
        {#key stillMissing}
          <MediaPlayer
            bind:this={player}
            url={resolved}
            kind="video"
            poster={still}
            onPosterError={() => (stillMissing ||= still !== undefined)}
            preload={still ? "none" : undefined}
            class="size-full"
          />
        {/key}
      {/if}
      <ExpandButton
        label={filename}
        onclick={() => {
          player?.handOff();
          onOpen(resolved, filename);
        }}
      />
    {:else if status === "error"}
      <button
        type="button"
        onclick={() => onOpen(resolved, filename)}
        data-shared={resolved}
        class="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-3 text-on-surface-variant"
      >
        <ImageOff size={18} class="shrink-0" />
        <span class="line-clamp-2 text-center text-body-sm">{alt || resolved}</span>
      </button>
    {:else if status === "loading" && near}
      <CenteredProgress class="pointer-events-none absolute inset-0" size={24} />
    {/if}
    {#if picture}
      <button
        type="button"
        onclick={() => onOpen(resolved, filename)}
        data-shared={resolved}
        aria-label={alt || filename}
        class="flex size-full cursor-pointer items-center justify-center {status === 'error' ? 'hidden' : ''}"
      >
        {#if near && shownUrl}
          <img
            use:imageSrc={{
              url: shownUrl,
              onload: () => (status = "ready"),
              onerror: () => (status = "error"),
            }}
            alt={alt || ""}
            draggable="false"
            class="max-h-full max-w-full object-contain"
          />
        {/if}
      </button>
    {/if}
  </div>
{/if}
