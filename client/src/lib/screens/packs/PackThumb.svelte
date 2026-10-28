<script lang="ts">
  import Package from "@lucide/svelte/icons/package";
  import { guessMimeType } from "$lib/data/previewKind";
  import { packSource } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import type { PackSource } from "$lib/design/packs/reader";
  import IconTile from "$lib/ui/IconTile.svelte";

  interface Props {
    pack: Pack;
    source?: PackSource | null;
  }

  const { pack, source = null }: Props = $props();

  let url = $state<string | null>(null);

  $effect(() => {
    const path = pack.info.preview;
    url = null;
    if (!path) return;
    let alive = true;
    let made: string | null = null;
    void (source ? Promise.resolve(source) : packSource(pack)).then((found) => {
      const bytes = found?.bytes(path);
      if (!alive || !bytes) return;
      made = URL.createObjectURL(new Blob([bytes as BlobPart], { type: guessMimeType(path) ?? "" }));
      url = made;
    });
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
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
