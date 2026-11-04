<script lang="ts">
  import Download from "@lucide/svelte/icons/download";
  import { joined } from "$lib/data/format";
  import { installTarget, type InstallRequest } from "$lib/data/installRequest";
  import { t } from "$lib/i18n/index.svelte";
  import ListRow from "$lib/ui/ListRow.svelte";
  import TrailingIcon from "$lib/ui/TrailingIcon.svelte";
  import { INSTALL_ICONS, INSTALL_LABELS, installName } from "./installKinds";
  import { installOffers } from "./installOffers.svelte";

  interface Props {
    items: InstallRequest[];
  }

  const { items }: Props = $props();
</script>

<div class="grid w-full grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-1 rounded-panel bg-card p-1">
  {#each items as item, index (index)}
    {@const name = installName(item)}
    {@const target = installTarget(item)}
    <ListRow
      icon={INSTALL_ICONS[item.kind]}
      title={name}
      subtitle={joined(t(INSTALL_LABELS[item.kind]), target !== name && target)}
      onclick={() => installOffers.offer(item)}
    >
      {#snippet trailing()}
        <TrailingIcon icon={Download} />
      {/snippet}
    </ListRow>
  {/each}
</div>
