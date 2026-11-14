<script lang="ts">
  import { imageCache } from "$lib/services/imageCache.svelte";
  import { fetchBlob } from "$lib/services/mediaSource";
  import IconTile from "./IconTile.svelte";
  import type { IconSource } from "./icons";

  interface Props {
    url: string | null;
    icon: IconSource;
  }

  const { url, icon }: Props = $props();

  let pixels = $state(0);

  const src = $derived(url ? imageCache.get(url, pixels) : null);

  $effect(() => {
    if (url && pixels) imageCache.load(url, () => fetchBlob(url), pixels);
  });
</script>

<IconTile {icon} {src} bind:pixels />
