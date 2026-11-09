<script lang="ts">
  import ImageOff from "@lucide/svelte/icons/image-off";
  import { visibleName } from "$lib/data/format";
  import { serverSettings } from "$lib/data/serverSettings.svelte";
  import { isVideo } from "$lib/data/previewKind";
  import { devicePixels, sizedImage } from "$lib/services/imageSize";
  import { imageSrc, posterSrc, servedSrc } from "$lib/services/mediaSource";
  import { fittedImageOf, videoStillOf } from "$lib/services/sharedApi";
  import CenteredProgress from "./CenteredProgress.svelte";
  import ExpandButton from "./ExpandButton.svelte";
  import { MEDIA_FRAME_CLASS } from "./mediaFrame";
  import { nearView } from "./nearView";

  interface Props {
    url: string;
    alt: string;
    poster?: string;
    onOpen: (url: string, filename: string) => void;
    compact?: boolean;
  }

  const { url, alt, poster, onOpen, compact = false }: Props = $props();

  const FRAME_ASPECT = 4 / 3;

  let status = $state<"loading" | "ready" | "error">("loading");
  let player = $state<HTMLVideoElement | null>(null);
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

  const video = $derived(isVideo(filename));

  let frameHeight = $state(0);
  let stillMissing = $state(false);

  const served = $derived(poster || !video ? null : videoStillOf(resolved));
  const still = $derived(
    stillMissing
      ? undefined
      : poster || (served ? sizedImage(served, devicePixels(frameHeight)) : undefined),
  );
  const shownUrl = $derived(
    video || !frameHeight ? undefined : fittedImageOf(resolved, devicePixels(frameHeight * FRAME_ASPECT)),
  );

  $effect(() => {
    serverSettings.ensure();
  });
</script>

<div
  use:nearView={() => (near = true)}
  bind:clientHeight={frameHeight}
  class="relative flex max-w-full shrink items-center justify-center overflow-hidden {MEDIA_FRAME_CLASS} bg-card select-none {compact
    ? 'h-40'
    : 'h-70'}"
  style:aspect-ratio={FRAME_ASPECT}
>
  {#if video}
    {#if near && frameHeight && served !== undefined}
      {#key stillMissing}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={player}
          use:servedSrc={{ url: resolved }}
          use:posterSrc={{ url: still ?? "", onerror: () => (stillMissing ||= still !== undefined) }}
          preload={still ? "none" : undefined}
          controls
          class="max-h-full max-w-full object-contain"
        ></video>
      {/key}
    {/if}
    <ExpandButton
      label={filename}
      onclick={() => {
        player?.pause();
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
  {#if !video}
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
