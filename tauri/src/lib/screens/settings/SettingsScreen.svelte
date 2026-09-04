<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { navigation } from "$lib/app/navigation.svelte";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { useRefreshTick } from "$lib/platform/useRefreshTick.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import SearchBar from "$lib/ui/SearchBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import type { SettingsSection } from "./sections";
  import ServerSection from "./ServerSection.svelte";
  import { entryFor, type SettingsEntry } from "./settingsIndex";
  import SettingsResults from "./SettingsResults.svelte";

  let refreshTick = $state(0);
  let refreshing = $state(false);
  let query = $state("");

  const tick = $derived(refreshTick);

  const refresh = () => {
    refreshing = true;
    refreshTick++;
  };

  useRefreshTick(refresh);

  $effect(() => {
    if (tick === 0) return;
    void serverStatus.refresh();
  });

  let blocks = $state<Partial<Record<SettingsSection, HTMLDivElement | null>>>({});

  const highlight = useHighlight((target) => {
    const section = entryFor(target)?.section ?? "about";
    blocks[section]?.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  let hosting = $state(false);

  const reveal = (entry: SettingsEntry) => {
    hosting = entry.dialog !== undefined && entry.section !== "claude";
    if (!hosting) query = "";
    if (entry.section === "claude") navigation.openClaude(entry.id);
    else navigation.openSettings(entry.id);
  };
</script>

<Screen title={t("SETTINGS")} {refreshing} onRefresh={refresh}>
  {#snippet actions()}
    {#if !isTouch}
      <TooltipIconButton label={t("REFRESH")} shortcut="window.refresh" onclick={refresh}>
        <RotateCw size={20} />
      </TooltipIconButton>
    {/if}
  {/snippet}
  {#snippet toolbar()}
    <div class="px-4 py-2">
      <SearchBar
        value={query}
        oninput={(value) => {
          query = value;
          hosting = false;
        }}
        placeholder={t("SETTINGS_SEARCH")}
      />
    </div>
  {/snippet}
  <div class="flex w-full flex-col px-4 pb-4">
    {#if query.trim()}
      <SettingsResults {query} onSelect={reveal} />
    {/if}
    <div class={query.trim() ? "hidden" : "contents"}>
      {#if !query.trim() || hosting}
      <div bind:this={blocks.client}>
        <ClientSection />
      </div>

      <div bind:this={blocks.background}>
        <BackgroundSection />
      </div>

      <div bind:this={blocks.connectivity}>
        <ConnectivitySection />
      </div>

      <div bind:this={blocks.server}>
        <ServerSection
          {tick}
          flash={highlight.is("server")}
          onLoadingChange={(value) => {
            if (!value) refreshing = false;
          }}
        />
      </div>

      <div bind:this={blocks.recovery}>
        <RecoverySection onChanged={() => refreshTick++} />
      </div>

      <div bind:this={blocks.about}>
        <AboutGroup flash={highlight.is("about")} />
      </div>
      {/if}
    </div>
  </div>
</Screen>
