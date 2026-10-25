<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import Package from "@lucide/svelte/icons/package";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Upload from "@lucide/svelte/icons/upload";
  import { joined } from "$lib/data/format";
  import { inspectPack, installPack } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { PACK_EXTENSION, PACK_MIME } from "$lib/design/packs/schema";
  import { t } from "$lib/i18n/index.svelte";
  import { systemName } from "$lib/platform";
  import { serverPacks, useServerPacks, type ServerPack } from "$lib/services/serverPacks.svelte";
  import ActionButton from "$lib/ui/ActionButton.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import DropOverlay from "$lib/ui/DropOverlay.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { fileDrop } from "$lib/ui/fileDrop";
  import IconTile from "$lib/ui/IconTile.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import SectionHeader from "$lib/ui/SectionHeader.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PackDialog from "./PackDialog.svelte";
  import { offerFiles } from "./packIntake";
  import { packOffers } from "./packOffers.svelte";
  import { contentsSummary, offeredPacks, packByline, packSummary } from "./packText";
  import PackThumb from "./PackThumb.svelte";

  interface Props {
    onDismiss: () => void;
  }

  const { onDismiss }: Props = $props();

  useServerPacks();

  const PICK_TYPES = [PACK_EXTENSION, ".zip", PACK_MIME];
  const UNTYPED_FILE = "application/octet-stream";
  const accept = (systemName() === "android" ? [...PICK_TYPES, UNTYPED_FILE] : PICK_TYPES).join(",");

  let picker = $state<HTMLInputElement | null>(null);
  let opened = $state<string | null>(null);
  let installing = $state<string | null>(null);

  const installed = $derived(packs.all.filter((pack) => !pack.builtin));
  const builtin = $derived(packs.all.filter((pack) => pack.builtin));
  const offered = $derived(offeredPacks());
  const openedPack = $derived(opened ? packs.packOf(opened) : undefined);

  const pick = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    offerFiles(Array.from(input.files ?? []));
    input.value = "";
  };

  const offerServer = (entry: ServerPack) => packOffers.offer(entry.file, () => serverPacks.download(entry));

  const installServer = async (entry: ServerPack) => {
    installing = entry.id;
    const blob = await serverPacks.download(entry);
    try {
      if (!blob) throw new Error();
      await installPack(await inspectPack(blob));
    } catch {
      packOffers.offer(entry.file, () => Promise.resolve(blob));
    } finally {
      installing = null;
    }
  };
</script>

{#snippet row(pack: Pack)}
  <ListRow
    title={pack.info.name}
    subtitle={joined(!pack.builtin && packByline(pack), packSummary(pack))}
    subtitleLines={2}
    onclick={() => (opened = pack.info.id)}
  >
    {#snippet leading()}
      <PackThumb {pack} />
    {/snippet}
  </ListRow>
{/snippet}

<CompactDialog title={t("PACKS")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
  {/snippet}
  <div use:fileDrop={{ accepts: () => true, drop: offerFiles }} class="relative flex w-full flex-col [--page-inset:0px]">
    <DropOverlay />
    <SectionHeader label={t("PACKS_INSTALLED")} />
    {#each installed as pack (pack.info.id)}
      {@render row(pack)}
    {:else}
      <EmptyState text={t("NO_PACKS_INSTALLED")} class="py-3" />
    {/each}
    <div class="mt-1 mb-2">
      <ActionButton text={t("IMPORT_PACK")} icon={Upload} onclick={() => picker?.click()} class="w-full" />
    </div>
    {#if offered.length}
      <SectionHeader label={t("PACKS_SERVER")} divider />
      {#each offered as offer (offer.entry.file)}
        <ListRow
          title={offer.entry.name}
          subtitle={offer.standing === "newer"
            ? joined(offer.entry.version, t("PACK_NEWER", packs.installedOf(offer.entry.id)?.info.version ?? ""))
            : joined(offer.entry.author, offer.entry.version, contentsSummary(offer.entry.contents))}
          subtitleLines={2}
          onclick={() => offerServer(offer.entry)}
        >
          {#snippet leading()}
            {#if offer.entry.preview}
              <img
                src={serverPacks.urlOf(offer.entry, "/preview")}
                alt=""
                draggable="false"
                class="size-11 shrink-0 rounded-lg object-cover"
              />
            {:else}
              <IconTile icon={Package} />
            {/if}
          {/snippet}
          {#snippet trailing()}
            <TooltipIconButton
              label={t(offer.standing === "newer" ? "PACK_UPDATE" : "PACK_INSTALL")}
              enabled={installing === null}
              onclick={() => void installServer(offer.entry)}
            >
              {#if offer.standing === "newer"}
                <RefreshCw />
              {:else}
                <Download />
              {/if}
            </TooltipIconButton>
          {/snippet}
        </ListRow>
      {/each}
    {/if}
    <SectionHeader label={t("PACKS_BUILTIN")} divider />
    {#each builtin as pack (pack.info.id)}
      {@render row(pack)}
    {/each}
  </div>
  <input bind:this={picker} type="file" {accept} multiple hidden onchange={pick} />
</CompactDialog>

{#if openedPack}
  <PackDialog pack={openedPack} onDismiss={() => (opened = null)} />
{/if}
