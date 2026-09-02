<script lang="ts">
  import { isDesktop } from "$lib/platform";
  import { backend } from "$lib/services/backend.svelte";
  import { claudeChangelog } from "$lib/services/githubApi";
  import ChangelogDialog from "$lib/ui/ChangelogDialog.svelte";
  import LocalServerGroup from "./LocalServerGroup.svelte";
  import ServerGroup from "./ServerGroup.svelte";

  interface Props {
    tick: number;
    flash?: boolean;
    onLoadingChange?: (loading: boolean) => void;
  }

  const { tick, flash = false, onLoadingChange }: Props = $props();

  let changelog = $state<string | null | undefined>(undefined);
</script>

<ServerGroup
  {tick}
  {flash}
  onLoadingChange={(value) => onLoadingChange?.(value)}
  onChangelog={(version) => (changelog = version)}
/>

{#if isDesktop}
  <LocalServerGroup serverReady={backend.configured} />
{/if}

{#if changelog !== undefined}
  {@const version = changelog}
  <ChangelogDialog
    load={() => claudeChangelog(version)}
    limitHeight={false}
    onDismiss={() => (changelog = undefined)}
  />
{/if}
