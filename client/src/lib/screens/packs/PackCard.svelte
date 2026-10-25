<script lang="ts">
  import { untrack } from "svelte";
  import { joined } from "$lib/data/format";
  import {
    canUsePack,
    inspectPack,
    installPack,
    standingOf,
    usePack,
    type InspectedPack,
  } from "$lib/design/packs/library";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import { packByline, packErrorText, packSummary } from "./packText";
  import PackThumb from "./PackThumb.svelte";

  interface Props {
    name: string;
    load: () => Promise<Blob | null>;
    onInspected?: (inspected: InspectedPack) => void;
  }

  const { name, load, onInspected }: Props = $props();

  type Action = { use: boolean };

  let inspected = $state<InspectedPack | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let confirming = $state<Action | null>(null);

  $effect(() => {
    let alive = true;
    void untrack(() => load())
      .then((blob) => {
        if (!blob) throw new Error();
        return inspectPack(blob);
      })
      .then((result) => {
        if (!alive) return;
        inspected = result;
        onInspected?.(result);
      })
      .catch((error: unknown) => {
        if (alive) failure = packErrorText(error);
      })
      .finally(() => {
        if (alive) loading = false;
      });
    return () => {
      alive = false;
    };
  });

  const standing = $derived(inspected ? standingOf(inspected.pack) : "new");
  const usable = $derived(inspected ? canUsePack(inspected.pack) : false);
  const installedVersion = $derived(inspected ? packs.installedOf(inspected.pack.info.id)?.info.version : undefined);
  const note = $derived(
    standing === "same"
      ? t("PACK_INSTALLED")
      : standing === "older"
        ? t("PACK_OLDER", installedVersion ?? "")
        : standing === "newer"
          ? t("PACK_NEWER", installedVersion ?? "")
          : null,
  );
  const installLabel = $derived(t(standing === "newer" ? "PACK_UPDATE" : standing === "older" ? "PACK_REPLACE" : "PACK_INSTALL"));

  const perform = async ({ use }: Action) => {
    if (!inspected) return;
    busy = true;
    failure = null;
    try {
      if (standingOf(inspected.pack) !== "same") await installPack(inspected);
      if (use) usePack(inspected.pack);
    } catch (error) {
      failure = packErrorText(error);
    } finally {
      busy = false;
    }
  };

  const request = (action: Action) => {
    if (standing === "older") confirming = action;
    else void perform(action);
  };
</script>

{#if loading}
  <CenteredProgress class="h-16" />
{:else if inspected}
  {@const pack = inspected.pack}
  <div class="flex flex-col gap-2.5">
    <div class="flex items-center gap-3">
      <PackThumb {pack} source={inspected.source} />
      <div class="min-w-0 flex-1">
        <p class="truncate text-item-title text-on-surface">{pack.info.name}</p>
        <p class="truncate text-body-sm text-on-surface-variant">{joined(name, packByline(pack))}</p>
        <p class="truncate text-body-sm text-on-surface-variant">{packSummary(pack)}</p>
      </div>
    </div>
    {#if note}
      <p class="text-body-sm text-on-surface-variant">{note}</p>
    {/if}
    {#if failure}
      <p class="text-body-sm text-red">{failure}</p>
    {/if}
    {#if standing !== "same" || usable}
      <div class="flex flex-wrap gap-2">
        {#if standing !== "same"}
          <Button
            small
            variant={usable ? "outlined" : "filled"}
            enabled={!busy}
            onclick={() => request({ use: false })}
          >
            {installLabel}
          </Button>
        {/if}
        {#if usable}
          <Button small enabled={!busy} onclick={() => request({ use: true })}>
            {t(standing === "same" ? "PACK_USE" : "PACK_INSTALL_USE")}
          </Button>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <p class="text-body-sm text-red">{failure}</p>
{/if}

{#if confirming && inspected}
  {@const action = confirming}
  <ConfirmDialog
    title={t("PACK_REPLACE")}
    text={t("PACK_REPLACE_CONFIRM", inspected.pack.info.name, installedVersion ?? "", inspected.pack.info.version)}
    confirmLabel={t("PACK_REPLACE")}
    onConfirm={() => {
      confirming = null;
      void perform(action);
    }}
    onDismiss={() => (confirming = null)}
  />
{/if}
