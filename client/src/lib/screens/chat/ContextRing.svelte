<script lang="ts">
  import { Tooltip } from "bits-ui";
  import type { AgentCost } from "$lib/data/agentModels";
  import {
    formatCurrency,
    formatDuration,
    formatPercent,
    formatSize,
    formatTokens,
    formatUsage,
    usageRatio,
  } from "$lib/data/format";
  import type { PromptCache } from "$lib/data/promptCache";
  import { ALERT_PERCENT, limitTone, usageWindowLabel, type LimitTone, type LimitWindow } from "$lib/data/usageWindows";
  import { isTouch } from "$lib/platform";
  import { t } from "$lib/i18n/index.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import ProgressRing from "$lib/ui/ProgressRing.svelte";
  import TouchTip from "$lib/ui/TouchTip.svelte";
  import { holdFocus, keepFocus } from "$lib/ui/keepFocus";
  import { TOOLTIP_CLASS } from "$lib/ui/menuSurface";

  interface Props {
    tokens: number;
    limit: number;
    bytes: number | null;
    totalBytes: number | null;
    byteLimit: number | null;
    cache: PromptCache | null;
    limits: LimitWindow[];
    cost?: AgentCost | null;
  }

  const { tokens, limit, bytes, totalBytes, byteLimit, cache, limits, cost = null }: Props = $props();

  const SIZE = 20;
  const STROKE = 2.5;
  const TOUCH_HIDE_MS = 2500;
  const HALF = 2;
  const PERCENT = 100;
  const ALERT_RATIO = ALERT_PERCENT / PERCENT;
  const MILLIS_PER_SECOND = 1000;
  const MILLIS_PER_MINUTE = 60_000;

  let touchTip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let trigger = $state<HTMLElement | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let open = $state(false);
  let now = $state(Date.now());

  const shown = $derived(open || touchTip !== null);
  const cacheLeft = $derived(cache ? Math.max(0, cache.expiresAt - now) : 0);
  const cacheUnit = (left: number) => (left > MILLIS_PER_MINUTE ? MILLIS_PER_MINUTE : MILLIS_PER_SECOND);
  const untilChange = (left: number) =>
    ((left - 1) % (left > 2 * MILLIS_PER_MINUTE ? MILLIS_PER_MINUTE : MILLIS_PER_SECOND)) + 1;

  $effect(() => {
    if (!shown || !cache) return;
    const expiresAt = cache.expiresAt;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const step = () => {
      const at = Date.now();
      now = at;
      const left = expiresAt - at;
      if (left > 0) timer = setTimeout(step, untilChange(left));
    };
    step();
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  });

  const hide = () => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
    touchTip = null;
  };

  const toggle = (event: MouseEvent) => {
    if (touchTip !== null) {
      hide();
      return;
    }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    touchTip = { x: box.left + box.width / HALF, top: box.top, bottom: box.bottom };
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, TOUCH_HIDE_MS);
  };

  const progress = $derived(usageRatio(tokens, limit));
  const strain = $derived(
    totalBytes !== null && byteLimit !== null
      ? Math.max(progress, usageRatio(totalBytes, byteLimit))
      : progress,
  );
</script>

{#snippet figure(label: string, value: string)}
  <div class="flex items-baseline justify-between gap-4">
    <span>{label}</span>
    <span class="text-on-surface-variant">{value}</span>
  </div>
{/snippet}

{#snippet meter(label: string, value: string, ratio: number, tone: LimitTone)}
  {@render figure(label, value)}
  <LinearProgress value={ratio} {tone} class="mt-1" />
{/snippet}

{#snippet gauge(label: string, used: number, cap: number, unit: (value: number) => string)}
  {@const ratio = usageRatio(used, cap)}
  {@render meter(label, formatUsage(used, cap, unit), ratio, ratio >= ALERT_RATIO ? "red" : "accent")}
{/snippet}

{#snippet detail()}
  <div class="w-52">
    {@render gauge(t("CONTEXT_LABEL"), tokens, limit, formatTokens)}
    {#if bytes !== null && byteLimit !== null}
      <div class="mt-2">
        {@render gauge(t("MEDIA_LABEL"), bytes, byteLimit, formatSize)}
      </div>
    {/if}
    {#if cost}
      <div class="mt-2">
        {@render figure(t("COST_LABEL"), formatCurrency(cost.amount, cost.currency))}
      </div>
    {/if}
    {#if cache}
      {@const ratio = usageRatio(cacheLeft, cache.ttl * MILLIS_PER_SECOND)}
      {@const unit = cacheUnit(cacheLeft)}
      <div class="mt-2">
        {@render meter(
          t("CACHE_LABEL"),
          cacheLeft > 0 ? formatDuration(Math.ceil(cacheLeft / unit) * unit) : t("CACHE_EXPIRED"),
          ratio,
          ratio <= 1 - ALERT_RATIO ? "red" : "accent",
        )}
        <p class="mt-1 text-caption text-on-surface-variant">{t("CACHE_READ", formatPercent(cache.readRatio))}</p>
      </div>
    {/if}
    {#if limits.length}
      <div class="my-2.5 border-t border-outline-variant"></div>
      {#each limits as window, index (window.id)}
        <div class={index ? "mt-2" : ""}>
          {@render meter(
            usageWindowLabel(window.id),
            formatPercent(window.percent / PERCENT),
            window.percent / PERCENT,
            limitTone(window),
          )}
        </div>
      {/each}
    {/if}
  </div>
{/snippet}

{#snippet ring()}
  <ProgressRing
    value={progress}
    size={SIZE}
    stroke={STROKE}
    trackClass="text-outline-variant"
    class={strain >= ALERT_RATIO ? "text-red" : "text-accent"}
  />
{/snippet}

{#if isTouch}
  <button
    bind:this={trigger}
    type="button"
    use:keepFocus
    onclick={toggle}
    aria-label={t("CONTEXT_USAGE")}
    class="ripple mr-0.5 ml-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center self-center rounded-full"
  >
    {@render ring()}
  </button>
  <TouchTip anchor={touchTip} within={trigger} onDismiss={hide}>
    {@render detail()}
  </TouchTip>
{:else}
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0} bind:open>
      <Tooltip.Trigger onmousedown={holdFocus} class="ripple mr-0.5 ml-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center self-center rounded-full">
        {@render ring()}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} class="z-75 {TOOLTIP_CLASS}">
          {@render detail()}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
