<script lang="ts">
  import Hourglass from "@lucide/svelte/icons/hourglass";
  import type { QueuedMessage } from "$lib/data/chatModels";
  import Chip from "$lib/ui/Chip.svelte";

  interface Props {
    queue: QueuedMessage[];
    onOpen: (item: QueuedMessage) => void;
  }

  const { queue, onOpen }: Props = $props();

  const label = (item: QueuedMessage) =>
    item.text || item.attachments.map((path) => path.split(/[\\/]/).pop()).join(", ");
</script>

<div class="flex gap-1.5 overflow-x-auto px-2 pt-1.5">
  {#each queue as item (item.id)}
    <Chip name={label(item)} icon={Hourglass} onclick={() => onOpen(item)} />
  {/each}
</div>
