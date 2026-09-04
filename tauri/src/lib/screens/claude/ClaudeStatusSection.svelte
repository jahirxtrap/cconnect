<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { entryFor, entryHint } from "$lib/screens/settings/settingsIndex";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import { indicatorTone } from "./serviceStatus";

  interface Props {
    enabled: boolean;
    pending: string;
    tick?: number;
    onOpen: () => void;
  }

  const { enabled, pending, tick = 0, onOpen }: Props = $props();

  const service = $derived(claudeStatus.service);
  const loading = $derived(claudeStatus.loading);

  const summary = $derived(
    (() => {
      const entry = entryFor("service_status");
      return (entry ? entryHint(entry) : "") || pending;
    })(),
  );

  $effect(() => {
    void tick;
    void backend.activeId;
    void claudeStatus.loadService();
  });
</script>

<SettingsGroup label={t("SERVICE_STATUS")}>
  {#snippet labelTrailing()}
    {#if loading}
      <LoadingIndicator size={20} />
    {:else if !service || service.error !== null}
      <StatusDot class="bg-gray" box={20} dot={12} />
    {:else}
      <StatusDot class={indicatorTone(service.indicator)} box={20} dot={12} />
    {/if}
  {/snippet}
  <PreferenceRow icon={Activity} title={t("SERVICE_STATUS")} {summary} {enabled} onclick={onOpen}>
    {#snippet trailing()}
      <ChevronRight size={24} class="text-on-surface-variant" />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>
