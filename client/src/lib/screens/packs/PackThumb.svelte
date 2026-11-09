<script lang="ts">
  import Package from "@lucide/svelte/icons/package";
  import { guessMimeType } from "$lib/data/previewKind";
  import { packSource } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import type { PackSource } from "$lib/design/packs/reader";
  import { packImageKey } from "$lib/design/packs/storage";
  import { imageCache } from "$lib/services/imageCache.svelte";
  import { scaledUrl } from "$lib/services/imageSize";
  import IconTile from "$lib/ui/IconTile.svelte";

  interface Props {
    pack: Pack;
    source?: PackSource | null;
  }

  const { pack, source = null }: Props = $props();

  let pixels = $state(0);
  let offered = $state<string | null>(null);

  const key = $derived(pack.info.preview && !source ? packImageKey(pack.info.id, pack.info.preview) : null);
  const url = $derived(key ? imageCache.get(key, pixels) : offered);

  const blobOf = (found: PackSource | null, path: string): Blob | null => {
    const bytes = found?.bytes(path);
    return bytes ? new Blob([bytes as BlobPart], { type: guessMimeType(path) ?? "" }) : null;
  };

  $effect(() => {
    const path = pack.info.preview;
    if (key && path && pixels) imageCache.load(key, async () => blobOf(await packSource(pack), path), pixels);
  });

  $effect(() => {
    const path = pack.info.preview;
    offered = null;
    const blob = source && path && pixels ? blobOf(source, path) : null;
    if (!blob) return;
    return scaledUrl(blob, pixels, (made) => (offered = made));
  });
</script>

<IconTile icon={Package} src={url} bind:pixels />
