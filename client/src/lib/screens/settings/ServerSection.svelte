<script lang="ts">
  import { isDesktop } from "$lib/platform";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import ServerGroup from "./ServerGroup.svelte";

  interface Props {
    tick: number;
    flash?: boolean;
  }

  const { tick, flash = false }: Props = $props();
</script>

<ServerGroup {tick} {flash} />

{#if isDesktop}
  <LocalServerGroup />
{/if}
