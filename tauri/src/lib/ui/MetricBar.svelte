<script lang="ts">
  import { formatDecimal } from "$lib/data/format";

  interface Props {
    title: string;
    subtitle: string;
    percent: number;
    alert?: boolean | null;
    color?: string | null;
    showValue?: boolean;
    class?: string;
  }

  const {
    title,
    subtitle,
    percent,
    alert = null,
    color = null,
    showValue = true,
    class: className = "",
  }: Props = $props();

  const ALERT_PERCENT = 90;
  const clamped = $derived(Math.min(100, Math.max(0, percent)));
  const alerting = $derived(alert ?? percent >= ALERT_PERCENT);
  const heading = $derived(!!title || !!subtitle || showValue);
</script>

<div class="w-full {className}">
  {#if heading}
    <div class="flex items-center">
      <div class="min-w-0 flex-1">
        {#if title}
          <p class="text-body-lg">{title}</p>
          <p class="truncate text-body-sm text-on-surface-variant">{subtitle}</p>
        {/if}
      </div>
      {#if showValue}
        <p class="ml-3 shrink-0 text-body-md">{formatDecimal(percent, 1)}%</p>
      {/if}
    </div>
  {/if}
  <div class="h-1 w-full overflow-hidden rounded-full bg-outline-variant {heading ? 'mt-2' : ''}">
    <div
      class="h-full rounded-full transition-[width] {alerting ? 'bg-red' : color ? '' : 'bg-accent'}"
      style="width: {clamped}%{!alerting && color ? `; background: ${color}` : ''}"
    ></div>
  </div>
</div>
