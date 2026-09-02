<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import { useHighlight } from "$lib/app/useHighlight.svelte";
  import Screen from "$lib/app/Screen.svelte";
  import { desktop } from "$lib/platform/desktop.svelte";
  import { serverStatus } from "$lib/data/serverStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { isTouch } from "$lib/platform";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import AboutGroup from "./AboutGroup.svelte";
  import BackgroundSection from "./BackgroundSection.svelte";
  import ClientSection from "./ClientSection.svelte";
  import ConnectivitySection from "./ConnectivitySection.svelte";
  import RecoverySection from "./RecoverySection.svelte";
  import ServerSection from "./ServerSection.svelte";

  let refreshTick = $state(0);
  let refreshing = $state(false);

  const tick = $derived(refreshTick + desktop.refreshTick);

  const refresh = () => {
    refreshing = true;
    refreshTick++;
  };

  $effect(() => {
    if (tick === 0) return;
    void serverStatus.refresh();
  });

  let serverSection = $state<HTMLDivElement | null>(null);
  let aboutSection = $state<HTMLDivElement | null>(null);

  const highlight = useHighlight((target) =>
    (target === "cli" ? serverSection : aboutSection)?.scrollIntoView({ block: "start", behavior: "smooth" }),
  );
</script>

<Screen title={t("SETTINGS")} {refreshing} onRefresh={refresh}>
  {#snippet actions()}
    {#if !isTouch}
      <TooltipIconButton label={t("REFRESH")} shortcut="window.refresh" onclick={refresh}>
        <RotateCw size={20} />
      </TooltipIconButton>
    {/if}
  {/snippet}
  <div class="flex w-full flex-col px-4 pb-4">
    <ClientSection />

    <BackgroundSection />

    <ConnectivitySection />

    <div bind:this={serverSection}>
      <ServerSection
        {tick}
        onLoadingChange={(value) => {
          if (!value) refreshing = false;
        }}
      />
    </div>

    <RecoverySection onChanged={() => refreshTick++} />

    <div bind:this={aboutSection}>
      <AboutGroup flash={highlight.is("about")} />
    </div>
  </div>
</Screen>
