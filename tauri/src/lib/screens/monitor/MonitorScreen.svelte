<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { navigation } from "$lib/app/navigation.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import AppTopBar from "$lib/ui/AppTopBar.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import { monitor } from "./monitor.svelte";
  import MonitorActions from "./MonitorActions.svelte";
  import MonitorContent from "./MonitorContent.svelte";

  const environment = $derived(backend.active);
</script>

<div class="flex h-full flex-col">
  <AppTopBar
    title={t("MONITOR")}
    subtitle={monitor.offline ? t("SERVER_UNAVAILABLE") : (environment?.name ?? null)}
  >
    {#snippet navigationIcon()}
      <TooltipIconButton label={t("BACK")} onclick={() => navigation.back()}>
        <ArrowLeft size={20} />
      </TooltipIconButton>
    {/snippet}
    {#snippet subtitleLeading()}
      {#if monitor.offline}
        <StatusDot class="bg-red" box={8} />
      {/if}
    {/snippet}
    {#snippet actions()}
      <MonitorActions />
    {/snippet}
  </AppTopBar>

  <MonitorContent />
</div>
