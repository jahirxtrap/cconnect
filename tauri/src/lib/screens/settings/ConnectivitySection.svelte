<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Server from "@lucide/svelte/icons/server";
  import SquareTerminal from "@lucide/svelte/icons/square-terminal";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import EnvironmentsDialog from "./EnvironmentsDialog.svelte";

  let dialogOpen = $state(false);
</script>

<SettingsGroup label={t("SETTINGS_CONNECTIVITY")}>
  <PreferenceRow
    icon={Server}
    title={t("ENVIRONMENTS")}
    summary={backend.active ? `${backend.active.name} • ${address(backend.active)}` : t("NO_ENVIRONMENTS")}
    onclick={() => (dialogOpen = true)}
  />
  <PreferenceRow
    icon={SquareTerminal}
    title={t("SSH_HOSTS")}
    summary={t("SSH_HOSTS_SUMMARY")}
    onclick={() => navigation.openSshHosts()}
  >
    {#snippet trailing()}
      <ChevronRight size={24} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>

{#if dialogOpen}
  <EnvironmentsDialog onDismiss={() => (dialogOpen = false)} />
{/if}
