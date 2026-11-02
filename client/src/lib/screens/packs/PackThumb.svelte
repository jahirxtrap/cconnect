<script lang="ts">
  import Package from "@lucide/svelte/icons/package";
  import { guessMimeType } from "$lib/data/previewKind";
  import { packSource } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import type { PackSource } from "$lib/design/packs/reader";
  import { packImageKey } from "$lib/design/packs/storage";
  import { imageCache } from "$lib/services/imageCache.svelte";
  import IconTile from "$lib/ui/IconTile.svelte";

  interface Props {
    pack: Pack;
    source?: PackSource | null;
  }

  const { pack, source = null }: Props = $props();

  let offered = $state<string | null>(null);

  const key = $derived(pack.info.preview && !source ? packImageKey(pack.info.id, pack.info.preview) : null);
  const url = $derived(key ? imageCache.get(key) : offered);

  const blobOf = (found: PackSource | null, path: string): Blob | null => {
    const bytes = found?.bytes(path);
    return bytes ? new Blob([bytes as BlobPart], { type: guessMimeType(path) ?? "" }) : null;
  };

  $effect(() => {
    const path = pack.info.preview;
    if (key && path) imageCache.load(key, async () => blobOf(await packSource(pack), path));
  });

  $effect(() => {
    const path = pack.info.preview;
    offered = null;
    if (!source || !path) return;
    const blob = blobOf(source, path);
    if (!blob) return;
    const made = URL.createObjectURL(blob);
    offered = made;
    return () => URL.revokeObjectURL(made);
  });
</script>

{#if url}
  <img
    src={url}
    alt=""
    draggable="false"
    class="size-11 shrink-0 rounded-lg object-cover"
  />
{:else}
  <IconTile icon={Package} />
{/if}
