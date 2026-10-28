<script lang="ts">
  import { canUsePack, installPack, standingOf, usePack, type InspectedPack } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { packs } from "$lib/design/packs/registry.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import ErrorText from "$lib/ui/ErrorText.svelte";
  import { FILE_ACTIONS, OPEN_EXTERNALLY_ACTION, type FileSource } from "$lib/ui/sharedFileActions";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PackCard from "./PackCard.svelte";
  import PackContent from "./PackContent.svelte";
  import PackDialog from "./PackDialog.svelte";
  import type { PackOffer } from "./packOffers.svelte";
  import { packErrorText, standingNote } from "./packText";

  interface Props {
    offer: PackOffer;
    onDismiss: () => void;
  }

  const { offer, onDismiss }: Props = $props();

  type Action = { use: boolean };

  const REMOTE_ACTIONS = FILE_ACTIONS.filter((action) => action !== OPEN_EXTERNALLY_ACTION);

  let inspected = $state.raw<InspectedPack | null>(null);
  let existing = $state.raw<Pack | null>(null);
  let failure = $state<string | null>(null);
  let busy = $state(false);
  let confirming = $state<Action | null>(null);

  const source = $derived<FileSource | null>(
    offer.url ? { url: offer.url } : offer.remote && inspected ? { blob: inspected.blob } : null,
  );
  const standing = $derived(inspected ? standingOf(inspected.pack) : "new");
  const usable = $derived(inspected ? canUsePack(inspected.pack) : false);
  const installedVersion = $derived(inspected ? packs.installedOf(inspected.pack.info.id)?.info.version : undefined);
  const note = $derived(standingNote(standing, installedVersion));
  const installLabel = $derived(t(standing === "newer" ? "PACK_UPDATE" : standing === "older" ? "PACK_REPLACE" : "PACK_INSTALL"));

  const perform = async ({ use }: Action) => {
    if (!inspected) return;
    busy = true;
    failure = null;
    try {
      await installPack(inspected);
      if (use) usePack(inspected.pack);
      onDismiss();
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

{#if existing}
  <PackDialog pack={existing} {onDismiss} />
{:else}
  <CompactDialog title={t("PACK")} {onDismiss}>
    {#snippet titleTrailing()}
      {#if source}
        {@const target = source}
        <div class="flex shrink-0 items-center">
          {#each REMOTE_ACTIONS as action (action.label)}
            {@const Icon = action.icon}
            <TooltipIconButton label={t(action.label)} onclick={() => void action.run(target, offer.name)}>
              <Icon />
            </TooltipIconButton>
          {/each}
        </div>
      {/if}
    {/snippet}
    {#snippet buttons()}
      <Button onclick={onDismiss} variant="outlined">{t("CLOSE")}</Button>
      {#if inspected}
        <Button variant={usable ? "outlined" : "filled"} enabled={!busy} onclick={() => request({ use: false })}>
          {installLabel}
        </Button>
        {#if usable}
          <Button enabled={!busy} onclick={() => request({ use: true })}>{t("PACK_USE")}</Button>
        {/if}
      {/if}
    {/snippet}
    <div class="flex w-full flex-col gap-3">
      <PackCard
        name={offer.name}
        load={offer.load}
        onInspected={(result) => (inspected = result)}
        onExisting={(pack) => (existing = pack)}
      />
      {#if note}
        <p class="text-body-sm text-on-surface-variant">{note}</p>
      {/if}
      {#if failure}
        <ErrorText text={failure} />
      {/if}
      {#if inspected}
        <PackContent pack={inspected.pack} source={inspected.source} />
      {/if}
    </div>
  </CompactDialog>
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
