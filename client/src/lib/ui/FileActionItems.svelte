<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import MenuItem from "./MenuItem.svelte";
  import { FILE_ACTION_LOOK, inFileOrder, type FileActionEntry } from "./sharedFileActions";

  interface Props {
    actions: FileActionEntry[];
  }

  const { actions }: Props = $props();
</script>

{#each inFileOrder(actions) as action (action.id)}
  {@const look = FILE_ACTION_LOOK[action.id]}
  <MenuItem icon={look.icon} text={t(look.label)} danger={action.id === "delete"} onclick={() => void action.run()} />
{/each}
