<script lang="ts">
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Server from "@lucide/svelte/icons/server";
  import Network from "@lucide/svelte/icons/network";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTauri } from "$lib/platform";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import EnvironmentsDialog from "./EnvironmentsDialog.svelte";
  import { entryFor, entryHint } from "./settingsIndex";
  import { useSettingsDialog } from "./useSettingsDialog.svelte";

  let dialogOpen = $state(false);

  useSettingsDialog("connectivity", () => (dialogOpen = true));

  const rowSummary = (id: string) => {
    const entry = entryFor(id);
    return entry ? entryHint(entry) : "";
  };
</script>

<SettingsGroup label={t("SETTINGS_CONNECTIVITY")}>
  <PreferenceRow
    icon={Server}
    title={t("ENVIRONMENTS")}
    summary={rowSummary("environments")}
    onclick={() => (dialogOpen = true)}
  />
  {#if isTauri}
    <PreferenceRow
      icon={Network}
      title={t("SSH_HOSTS")}
      summary={t("SSH_HOSTS_SUMMARY")}
      onclick={() => navigation.openSshHosts()}
    >
      {#snippet trailing()}
        <ChevronRight size={24} class="text-on-surface-variant" />
      {/snippet}
    </PreferenceRow>
  {/if}
</SettingsGroup>

{#if dialogOpen}
  <EnvironmentsDialog onDismiss={() => (dialogOpen = false)} />
{/if}
