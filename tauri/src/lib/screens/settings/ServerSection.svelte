<script lang="ts">
  import { isDesktop } from "$lib/platform";
  import { backend } from "$lib/services/backend.svelte";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import ServerGroup from "./ServerGroup.svelte";

  interface Props {
    tick: number;
    onLoadingChange?: (loading: boolean) => void;
  }

  const { tick, onLoadingChange }: Props = $props();
</script>

<ServerGroup {tick} onLoadingChange={(value) => onLoadingChange?.(value)} />

{#if isDesktop}
  <LocalServerGroup serverReady={backend.configured} />
{/if}
