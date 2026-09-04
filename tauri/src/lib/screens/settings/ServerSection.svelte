<script lang="ts">
  import { isDesktop } from "$lib/platform";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import ServerGroup from "./ServerGroup.svelte";

  interface Props {
    tick: number;
    flash?: boolean;
    onLoadingChange?: (loading: boolean) => void;
  }

  const { tick, flash = false, onLoadingChange }: Props = $props();
</script>

<ServerGroup {tick} {flash} onLoadingChange={(value) => onLoadingChange?.(value)} />

{#if isDesktop}
  <LocalServerGroup />
{/if}
