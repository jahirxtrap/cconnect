<script lang="ts">
  import { formatDecimal } from "$lib/data/format";
  import { ALERT_PERCENT, type LimitTone } from "$lib/data/usageWindows";
  import LinearProgress from "./LinearProgress.svelte";

  interface Props {
    title: string;
    subtitle: string;
    percent: number;
    alert?: boolean | null;
    tone?: LimitTone | null;
    color?: string | null;
    showValue?: boolean;
    class?: string;
  }

  const {
    title,
    subtitle,
    percent,
    alert = null,
    tone = null,
    color = null,
    showValue = true,
    class: className = "",
  }: Props = $props();

  const PERCENT = 100;
  const clamped = $derived(Math.min(PERCENT, Math.max(0, percent)));
  const alerting = $derived(alert ?? (tone === null && percent >= ALERT_PERCENT));
  const shownTone = $derived<LimitTone>(alerting ? "red" : (tone ?? "accent"));
  const heading = $derived(!!title || !!subtitle || showValue);
</script>

<div class="w-full {className}">
  {#if heading}
    <div class="flex items-center">
      <div class="min-w-0 flex-1">
        {#if title}
          <p class="text-item-title">{title}</p>
          <p class="truncate text-body-sm text-on-surface-variant">{subtitle}</p>
        {/if}
      </div>
      {#if showValue}
        <p class="ml-3 shrink-0 text-body-md">{formatDecimal(percent, 1)}%</p>
      {/if}
    </div>
  {/if}
  <LinearProgress
    value={clamped / PERCENT}
    tone={shownTone}
    color={shownTone === "accent" ? color : null}
    class={heading ? "mt-2" : ""}
  />
</div>
