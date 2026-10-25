<script lang="ts">
  import type { InspectedPack } from "$lib/design/packs/library";
  import { t } from "$lib/i18n/index.svelte";
  import Button from "$lib/ui/Button.svelte";
  import CompactDialog from "$lib/ui/CompactDialog.svelte";
  import { SHARED_FILE_ACTIONS } from "$lib/ui/sharedFileActions";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import PackCard from "./PackCard.svelte";
  import PackContent from "./PackContent.svelte";
  import type { PackOffer } from "./packOffers.svelte";

  interface Props {
    offer: PackOffer;
    onDismiss: () => void;
  }

  const { offer, onDismiss }: Props = $props();

  let inspected = $state.raw<InspectedPack | null>(null);
</script>

<CompactDialog title={t("PACK")} {onDismiss}>
  {#snippet titleTrailing()}
    {#if offer.url}
      {@const url = offer.url}
      <div class="flex shrink-0 items-center">
        {#each SHARED_FILE_ACTIONS as action (action.label)}
          {@const Icon = action.icon}
          <TooltipIconButton label={t(action.label)} onclick={() => void action.run(url, offer.name)}>
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
    <PackCard name={offer.name} load={offer.load} onInspected={(result) => (inspected = result)} />
    {#if inspected}
      <PackContent pack={inspected.pack} source={inspected.source} />
    {/if}
  </div>
</CompactDialog>
