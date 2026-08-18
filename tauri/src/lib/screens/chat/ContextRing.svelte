<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { isTouch } from "$lib/platform";
  import { t } from "$lib/i18n/index.svelte";
  import TouchTip from "$lib/ui/TouchTip.svelte";

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
  const TOUCH_HIDE_MS = 2500;
  const HALF = 2;

  let touchTip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const reveal = (event: MouseEvent) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    touchTip = { x: box.left + box.width / HALF, top: box.top, bottom: box.bottom };
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => (touchTip = null), TOUCH_HIDE_MS);
  };

  const radius = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = $derived(Math.min(1, Math.max(0, tokens / limit)));
  const percent = $derived(Math.round(progress * 100));

  const format = (value: number) => {
    if (value < MILLION) return `${Math.round(value / THOUSAND)}K`;
    const millions = value / MILLION;
    return Number.isInteger(millions) ? `${millions}M` : `${Math.round(millions * 10) / 10}M`;
  };

  const summary = $derived(`${format(tokens)} / ${format(limit)} · ${percent}%`);
</script>

{#snippet ring()}
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
{/snippet}

{#if isTouch}
  <button
    type="button"
    onclick={reveal}
    aria-label={t("CONTEXT_USAGE")}
    class="ripple ml-1 mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
  >
    {@render ring()}
  </button>
  <TouchTip text={summary} anchor={touchTip} />
{:else}
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger class="ripple ml-1 mr-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full">
        {@render ring()}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} class="z-75 rounded-sm bg-surface-variant px-2 py-1 text-body-sm shadow-lg">
          {summary}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
