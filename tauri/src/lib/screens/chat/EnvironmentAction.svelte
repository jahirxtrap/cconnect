<script lang="ts">
  import Server from "@lucide/svelte/icons/server";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { address, backend } from "$lib/services/backend.svelte";
  import SelectDialog from "$lib/ui/SelectDialog.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { inPane } from "./paneSurface";
  import { tabs } from "./tabs.svelte";

  const compact = inPane();

  let open = $state(false);
</script>

{#if !compact}
  <TooltipIconButton
    label={t("ENVIRONMENT")}
    enabled={!settings.environmentLocked}
    onclick={() => (open = true)}
  >
    <Server />
  </TooltipIconButton>

  {#if open}
    <SelectDialog
      title={t("ENVIRONMENT")}
      empty={t("NO_ENVIRONMENTS")}
      options={backend.environments.map((profile) => ({
        value: profile.id,
        label: profile.name,
        subtitle: address(profile),
      }))}
      selected={tabs.state.environmentId ?? ""}
      onSelect={(id) => tabs.state.selectEnvironment(id)}
      onDismiss={() => (open = false)}
    />
  {/if}
{/if}
