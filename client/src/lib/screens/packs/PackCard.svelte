<script lang="ts">
  import { untrack } from "svelte";
  import { joined } from "$lib/data/format";
  import { inspectPack, standingOf, type InspectedPack } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { PackError } from "$lib/design/packs/reader";
  import { packs } from "$lib/design/packs/registry.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import { packByline, packErrorText, packSummary } from "./packText";
  import PackThumb from "./PackThumb.svelte";

  interface Props {
    name: string;
    load: () => Promise<Blob | null>;
    onInspected: (inspected: InspectedPack) => void;
    onExisting: (pack: Pack) => void;
  }

  const { name, load, onInspected, onExisting }: Props = $props();

  const showExisting = (pack: Pack | undefined) => {
    if (!pack) return false;
    onExisting(pack);
    return true;
  };

  let inspected = $state<InspectedPack | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);

  $effect(() => {
    let alive = true;
    void untrack(() => load())
      .then((blob) => {
        if (!blob) throw new Error();
        return inspectPack(blob);
      })
      .then((result) => {
        if (!alive) return;
        if (standingOf(result.pack) === "same" && showExisting(packs.installedOf(result.pack.info.id))) return;
        inspected = result;
        onInspected(result);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof PackError && error.code === "reserved" && showExisting(packs.packOf(error.args[0]))) return;
        failure = packErrorText(error);
      })
      .finally(() => {
        if (alive) loading = false;
      });
    return () => {
      alive = false;
    };
  });
</script>

{#if loading}
  <CenteredProgress class="h-16" />
{:else if inspected}
  {@const pack = inspected.pack}
  <div class="flex items-center gap-3">
    <PackThumb {pack} source={inspected.source} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-item-title text-on-surface">{pack.info.name}</p>
      <p class="truncate text-body-sm text-on-surface-variant">{joined(name, packByline(pack))}</p>
      <p class="truncate text-body-sm text-on-surface-variant">{packSummary(pack)}</p>
    </div>
  </div>
{:else if failure}
  <ErrorText text={failure} />
{/if}
