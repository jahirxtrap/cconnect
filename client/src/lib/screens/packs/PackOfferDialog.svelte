<script lang="ts">
  import type { InspectedPack } from "$lib/design/packs/library";
  import type { Pack } from "$lib/design/packs/model";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { FILE_ACTIONS, type FileSource } from "$lib/ui/sharedFileActions";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PackCard from "./PackCard.svelte";
  import PackContent from "./PackContent.svelte";
  import PackDialog from "./PackDialog.svelte";
  import type { PackOffer } from "./packOffers.svelte";

  interface Props {
    offer: PackOffer;
    onDismiss: () => void;
  }

  const { offer, onDismiss }: Props = $props();

  let inspected = $state.raw<InspectedPack | null>(null);
  let existing = $state.raw<Pack | null>(null);

  const source = $derived<FileSource | null>(
    offer.url ? { url: offer.url } : inspected ? { blob: inspected.blob } : null,
  );
</script>

{#if existing}
  <PackDialog pack={existing} {onDismiss} />
{:else}
  <CompactDialog title={t("PACK")} {onDismiss}>
    {#snippet titleTrailing()}
      {#if source}
        {@const target = source}
        <div class="flex shrink-0 items-center">
          {#each FILE_ACTIONS as action (action.label)}
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
    {/snippet}
    <div class="flex w-full flex-col gap-3">
      <PackCard
        name={offer.name}
        load={offer.load}
        onInspected={(result) => (inspected = result)}
        onExisting={(pack) => (existing = pack)}
      />
      {#if inspected}
        <PackContent pack={inspected.pack} source={inspected.source} />
      {/if}
    </div>
  </CompactDialog>
{/if}
