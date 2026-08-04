<script lang="ts">
  import { Tooltip } from "bits-ui";

  interface Props {
    tokens: number;
    limit: number;
  }

  const { tokens, limit }: Props = $props();

  const SIZE = 20;
  const STROKE = 2.5;
  const ALERT_PERCENT = 90;
  const MILLION = 1_000_000;
  const THOUSAND = 1000;

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = $derived(Math.min(1, Math.max(0, tokens / limit)));
  const percent = $derived(Math.round(progress * 100));

  const format = (value: number) => {
    if (value < MILLION) return `${Math.round(value / THOUSAND)}K`;
    const millions = value / MILLION;
    return Number.isInteger(millions) ? `${millions}M` : `${Math.round(millions * 10) / 10}M`;
  };
</script>

<Tooltip.Provider>
  <Tooltip.Root delayDuration={200}>
    <Tooltip.Trigger class="flex size-8 shrink-0 items-center justify-center">
      <svg width={SIZE} height={SIZE} viewBox="0 0 {SIZE} {SIZE}" class="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          stroke-width={STROKE}
          class="text-outline-variant"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          stroke-width={STROKE}
          stroke-linecap="round"
          stroke-dasharray={circumference}
          stroke-dashoffset={circumference * (1 - progress)}
          class={percent >= ALERT_PERCENT ? "text-red" : "text-accent"}
        />
      </svg>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        sideOffset={6}
        class="z-50 rounded-panel bg-surface-variant px-2 py-1 text-body-sm shadow-lg"
      >
        {format(tokens)} / {format(limit)} · {percent}%
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
