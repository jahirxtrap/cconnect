<script lang="ts">
  import { formatDayTime, parseIsoMillis } from "$lib/data/time";
  import { severityTone, usageWindowLabel, type UsageWindow } from "$lib/data/usageWindows";
  import { t } from "$lib/i18n/index.svelte";
  import MetricBar from "$lib/ui/MetricBar.svelte";

  interface Props {
    windows: UsageWindow[];
    class?: string;
  }

  const { windows, class: className = "" }: Props = $props();

  const MILLIS_PER_HOUR = 3_600_000;
  const MILLIS_PER_MINUTE = 60_000;
  const HOURS_PER_DAY = 24;

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
</script>

<div class="flex flex-col gap-3.5 {className}">
  {#each windows as window (window.id)}
    <MetricBar
      title={usageWindowLabel(window.id)}
      subtitle={window.unused ? t("USAGE_UNUSED") : (window.detail ?? resetsLabel(window.resetsAt))}
      percent={window.percent}
      tone={severityTone(window.severity)}
    />
  {/each}
</div>
