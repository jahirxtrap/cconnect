<script lang="ts">
  import ImageOff from "@lucide/svelte/icons/image-off";
  import { backend } from "$lib/services/backend.svelte";
  import { mediaSrc } from "$lib/services/mediaSource";
  import CenteredProgress from "./CenteredProgress.svelte";

  interface Props {
    url: string;
    alt: string;
    onOpen: (url: string, filename: string) => void;
  }

  const { url, alt, onOpen }: Props = $props();

  const API_SUFFIX = "/api";

  let state = $state<"loading" | "ready" | "error">("loading");

  const resolved = $derived(
    url.startsWith("http://") || url.startsWith("https://")
      ? url
      : url.startsWith("/")
        ? `${backend.baseUrl.replace(new RegExp(`${API_SUFFIX}$`), "")}${url}`
        : url,
  );

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
  class="flex aspect-4/3 h-70 max-w-full shrink items-center justify-center overflow-hidden rounded-panel border border-outline-variant"
>
  {#if state === "error"}
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
      class="max-h-full max-w-full object-contain"
    />
  </button>
</div>
