<script lang="ts">
  import { navigation } from "$lib/app/navigation.svelte";
  import { type SshProfile } from "$lib/data/sshStore.svelte";
  import { isTauri } from "$lib/platform";
  import { sshLink } from "./sshLink";
  import SshHostsList from "./SshHostsList.svelte";
  import TerminalSession from "./TerminalSession.svelte";

  let active = $state<SshProfile | null>(null);

  const open = (profile: SshProfile) => {
    navigation.pushLayer();
    active = profile;
  };

  $effect(() =>
    navigation.intercept(() => {
      if (active === null) return false;
      active = null;
      return true;
    }),
  );
</script>

{#if active}
  {@const profile = active}
  <TerminalSession
    title={profile.name || profile.host}
    connect={(hooks, cols, rows) => sshLink(profile, hooks, cols, rows)}
    unavailable={!isTauri}
    onClose={() => navigation.popLayer()}
  />
{:else}
  <SshHostsList onSelect={open} onBack={() => navigation.back()} />
{/if}
