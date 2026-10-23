<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Screen from "$lib/app/Screen.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { SettingsSection } from "./sections";
  import SettingsSections from "./SettingsSections.svelte";
  import { useSettingsPage } from "./settingsPage.svelte";

  let blocks = $state<Partial<Record<SettingsSection, HTMLElement | null>>>({});

  const page = useSettingsPage((section) => blocks[section]?.scrollIntoView({ block: "start", behavior: "instant" }));
</script>

<Screen title={t("SETTINGS")} refreshing={page.refreshing} onRefresh={() => void page.refresh()}>
  {#snippet actions()}
    {#if !isTouch}
      <TooltipIconButton label={t("REFRESH")} shortcut="window.refresh" onclick={() => void page.refresh()}>
        <RotateCw />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet toolbar()}
    <div class="px-4 py-2">
      <SearchBar value={page.query} oninput={page.search} placeholder={t("SETTINGS_SEARCH")} />
    </div>
  {/snippet}
  <div class="flex w-full flex-col px-4 pb-4">
    <SettingsSections {page} bind:blocks />
  </div>
</Screen>
