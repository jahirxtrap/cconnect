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

{#if state === "error"}
  <button
    type="button"
    onclick={() => onOpen(resolved, filename)}
    class="flex w-full cursor-pointer items-center gap-2 rounded-panel p-3 text-left text-on-surface-variant"
  >
    <ImageOff size={18} class="shrink-0" />
    <span class="truncate text-body-sm">{alt || resolved}</span>
  </button>
{:else}
  <div class="w-full">
    {#if state === "loading"}
      <CenteredProgress class="h-35 w-full" size={24} />
    {/if}
    <button
      type="button"
      onclick={() => onOpen(resolved, filename)}
      aria-label={alt || filename}
      class="block w-full cursor-pointer {state === 'loading' ? 'hidden' : ''}"
    >
      <img
        use:mediaSrc={{
          url: resolved,
          onload: () => (state = "ready"),
          onerror: () => (state = "error"),
        }}
        alt={alt || ""}
        class="mx-auto max-w-full rounded-panel"
      />
    </button>
  </div>
{/if}
