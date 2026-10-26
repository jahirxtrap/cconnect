<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import { claudeStatus } from "$lib/data/claudeStatus.svelte";
  import { t } from "$lib/i18n/index.svelte";
  import { backend } from "$lib/services/backend.svelte";
  import { entryFor, entryText } from "$lib/screens/settings/settingsIndex";
  import PreferenceRow from "$lib/ui/PreferenceRow.svelte";
  import SettingsGroup from "$lib/ui/SettingsGroup.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";
  import TrailingIcon from "$lib/ui/TrailingIcon.svelte";
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
      return (entry ? entryText(entry) : "") || pending;
    })(),
  );

  let asked: number | null = null;

  $effect(() => {
    const current = tick;
    void backend.activeId;
    const manual = asked !== null && current !== asked;
    asked = current;
    void claudeStatus.loadService(manual);
  });
</script>

<SettingsGroup label={t("SERVICE_STATUS")}>
  {#snippet labelTrailing()}
    <StatusDot
      {loading}
      class={!service || service.error !== null ? "bg-gray" : indicatorTone(service.indicator)}
    />
  {/snippet}
  <PreferenceRow icon={Activity} title={t("SERVICE_STATUS")} {summary} {enabled} onclick={onOpen}>
    {#snippet trailing()}
      <TrailingIcon icon={ChevronRight} />
    {/snippet}
  </PreferenceRow>
</SettingsGroup>
