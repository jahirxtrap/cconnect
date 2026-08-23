<script lang="ts">
  import { formatDecimal } from "$lib/data/format";

  interface Props {
    title: string;
    subtitle: string;
    percent: number;
    alert?: boolean | null;
    color?: string | null;
    class?: string;
  }

  const { title, subtitle, percent, alert = null, color = null, class: className = "" }: Props = $props();

  const ALERT_PERCENT = 90;
  const clamped = $derived(Math.min(100, Math.max(0, percent)));
  const alerting = $derived(alert ?? percent >= ALERT_PERCENT);
</script>

<div class="w-full {className}">
  <div class="flex items-center">
    <div class="min-w-0 flex-1">
      <p class="text-body-lg">{title}</p>
      <p class="truncate text-body-sm text-on-surface-variant">{subtitle}</p>
    </div>
    <p class="ml-3 shrink-0 text-body-md">{formatDecimal(percent, 1)}%</p>
  </div>
  <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-outline-variant">
    <div
      class="h-full rounded-full transition-[width] {alerting ? 'bg-red' : color ? '' : 'bg-accent'}"
      style="width: {clamped}%{!alerting && color ? `; background: ${color}` : ''}"
    ></div>
  </div>
</div>
