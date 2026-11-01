<script lang="ts">
  import { formatPercent } from "$lib/data/format";
  import { formatDayTime, parseIsoMillis } from "$lib/data/time";
  import { severityTone, usageTitle, type UsageWindow } from "$lib/data/usageWindows";
  import { t } from "$lib/i18n/index.svelte";
  import CollapsibleSection from "$lib/ui/CollapsibleSection.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";

  interface Props {
    windows: UsageWindow[];
    class?: string;
  }

  const { windows, class: className = "" }: Props = $props();

  const MILLIS_PER_HOUR = 3_600_000;
  const MILLIS_PER_MINUTE = 60_000;
  const HOURS_PER_DAY = 24;
  const PERCENT = 100;

  const resetsLabel = (resetsAt: string | null) => {
    const millis = resetsAt === null ? null : parseIsoMillis(resetsAt);
    if (millis === null) return "—";
    const remaining = millis - Date.now();
    if (remaining <= 0) return "—";
    if (remaining < HOURS_PER_DAY * MILLIS_PER_HOUR) {
      const hours = Math.floor(remaining / MILLIS_PER_HOUR);
      const minutes = Math.floor((remaining % MILLIS_PER_HOUR) / MILLIS_PER_MINUTE);
      return t("RESETS_IN", hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
    }
    return t("RESETS_ON", formatDayTime(millis));
  };

  const subtitleOf = (window: UsageWindow) => {
    if (window.unused) return t("USAGE_UNUSED");
    if (window.detail !== null) return window.detail;
    if (window.share !== null) return t("USAGE_WEEK_SHARE", formatPercent(window.share / PERCENT));
    return resetsLabel(window.resetsAt);
  };

  let opened = $state<Record<string, boolean>>({});
</script>

<div class="flex flex-col gap-3.5 {className}">
  {#each windows as window (window.id)}
    <div class="flex flex-col gap-2">
      <MetricBar
        title={usageTitle(window)}
        subtitle={subtitleOf(window)}
        percent={window.percent}
        tone={severityTone(window.severity)}
      />
      {#if window.breakdown.length}
        <CollapsibleSection
          label={t("USAGE_BREAKDOWN")}
          open={opened[window.id] ?? false}
          onToggle={() => (opened[window.id] = !opened[window.id])}
        >
          {#each window.breakdown as row (row.key)}
            <MetricBar title={row.label} subtitle="" percent={row.percent} alert={false} />
          {/each}
        </CollapsibleSection>
      {/if}
    </div>
  {/each}
</div>
