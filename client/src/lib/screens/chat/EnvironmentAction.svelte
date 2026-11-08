<script lang="ts">
  import Server from "@lucide/svelte/icons/server";
  import { settings } from "$lib/data/settings.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { environmentOptions } from "$lib/services/backend.svelte";
  import ChoiceMenu from "$lib/ui/ChoiceMenu.svelte";
  import { inPane } from "./paneSurface";
  import { tabs } from "./tabs.svelte";

  const compact = inPane();
</script>

{#if !compact}
  <ChoiceMenu
    label={t("ENVIRONMENT")}
    icon={Server}
    enabled={!settings.environmentLocked}
    empty={t("NO_ENVIRONMENTS")}
    options={environmentOptions()}
    selected={tabs.state.environmentId ?? ""}
    onSelect={(id) => tabs.state.selectEnvironment(id)}
  />
{/if}
