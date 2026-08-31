<script lang="ts">
  import { formatDecimal } from "$lib/data/format";
  import LinearProgress from "./LinearProgress.svelte";

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
  const PERCENT = 100;
  const clamped = $derived(Math.min(PERCENT, Math.max(0, percent)));
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
  <LinearProgress
    value={clamped / PERCENT}
    tone={alerting ? "red" : "accent"}
    color={alerting ? null : color}
    class={heading ? "mt-2" : ""}
  />
</div>
