<script lang="ts">
  import ImageOff from "@lucide/svelte/icons/image-off";
  import { backend } from "$lib/services/backend.svelte";
  import { isVideo } from "$lib/data/previewKind";
  import { mediaSrc } from "$lib/services/mediaSource";
  import CenteredProgress from "./CenteredProgress.svelte";

  interface Props {
    url: string;
    alt: string;
    onOpen: (url: string, filename: string) => void;
    compact?: boolean;
  }

  const { url, alt, onOpen, compact = false }: Props = $props();

  const API_SUFFIX = "/api";

  let state = $state<"loading" | "ready" | "error">("loading");

  const resolved = $derived(
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : url.startsWith("/")
        ? `${backend.baseUrl.replace(new RegExp(`${API_SUFFIX}$`), "")}${url}`
        : url,
  );

  const video = $derived(isVideo(resolved));

  const filename = $derived.by(() => {
    const raw = resolved.split(/[?#]/)[0].split("/").pop() ?? "";
    try {
      return decodeURIComponent(raw) || "image";
    } catch {
      return raw || "image";
    }
  });
</script>

<div
  class="flex aspect-4/3 max-w-full shrink items-center justify-center overflow-hidden rounded-panel border border-outline-variant select-none {compact
    ? 'h-40'
    : 'h-70'} {video ? 'bg-black' : ''}"
>
  {#if video}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video use:mediaSrc={{ url: resolved }} controls class="max-h-full max-w-full object-contain"></video>
  {:else if state === "error"}
    <button
      type="button"
      onclick={() => onOpen(resolved, filename)}
      class="flex size-full cursor-pointer flex-col items-center justify-center gap-2 p-3 text-on-surface-variant"
    >
      <ImageOff size={18} class="shrink-0" />
      <span class="line-clamp-2 text-center text-body-sm">{alt || resolved}</span>
    </button>
  {:else if state === "loading"}
    <CenteredProgress class="size-full" size={24} />
  {/if}
  {#if !video}
    <button
      type="button"
      onclick={() => onOpen(resolved, filename)}
      aria-label={alt || filename}
      class="flex size-full cursor-pointer items-center justify-center {state === 'ready' ? '' : 'hidden'}"
    >
      <img
        use:mediaSrc={{
          url: resolved,
          onload: () => (state = "ready"),
          onerror: () => (state = "error"),
        }}
        alt={alt || ""}
        draggable="false"
        class="max-h-full max-w-full object-contain"
      />
    </button>
  {/if}
</div>
