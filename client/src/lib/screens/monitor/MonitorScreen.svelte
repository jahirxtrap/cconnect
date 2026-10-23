<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { monitor } from "./monitor.svelte";
  import MonitorActions from "./MonitorActions.svelte";
  import MonitorContent from "./MonitorContent.svelte";
  import MonitorTabs from "./MonitorTabs.svelte";

  monitor.forget();
</script>

<div class="flex h-full flex-col">
  <AppTopBar title={t("MONITOR")} server>
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft />
      </TooltipIconButton>
    {/snippet}
    {#snippet controls()}
      {#if !layout.mobile}
        <MonitorTabs />
      {/if}
    {/snippet}
    {#snippet actions()}
      <MonitorActions />
    {/snippet}
  </AppTopBar>

  {#if layout.mobile}
    <div class="px-(--page-inset) pb-2">
      <MonitorTabs fill />
    </div>
  {/if}
  <MonitorContent />
</div>
