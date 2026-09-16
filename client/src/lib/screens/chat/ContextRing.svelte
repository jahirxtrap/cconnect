<script lang="ts">
  import { Tooltip } from "bits-ui";
  import { formatSize, formatTokens, formatUsage, usageRatio } from "$lib/data/format";
  import { isTouch } from "$lib/platform";
  import { t } from "$lib/i18n/index.svelte";
  import LinearProgress from "$lib/ui/LinearProgress.svelte";
  import ProgressRing from "$lib/ui/ProgressRing.svelte";
  import TouchTip from "$lib/ui/TouchTip.svelte";
  import { holdFocus, keepFocus } from "$lib/ui/keepFocus";

  interface Props {
    tokens: number;
    limit: number;
    bytes: number | null;
    totalBytes: number | null;
    byteLimit: number | null;
  }

  const { tokens, limit, bytes, totalBytes, byteLimit }: Props = $props();

  const SIZE = 20;
  const STROKE = 2.5;
  const ALERT_RATIO = 0.9;
  const TOUCH_HIDE_MS = 2500;
  const HALF = 2;

  let touchTip = $state<{ x: number; top: number; bottom: number } | null>(null);
  let trigger = $state<HTMLElement | null>(null);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

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

{#snippet gauge(label: string, used: number, cap: number, unit: (value: number) => string)}
  {@const ratio = usageRatio(used, cap)}
  <div class="flex items-baseline justify-between gap-4">
    <span>{label}</span>
    <span class="text-on-surface-variant">{formatUsage(used, cap, unit)}</span>
  </div>
  <LinearProgress value={ratio} tone={ratio >= ALERT_RATIO ? "red" : "accent"} class="mt-1" />
{/snippet}

{#snippet detail()}
  <div class="w-52">
    {@render gauge(t("CONTEXT_LABEL"), tokens, limit, formatTokens)}
    {#if bytes !== null && byteLimit !== null}
      <div class="mt-2">
        {@render gauge(t("MEDIA_LABEL"), bytes, byteLimit, formatSize)}
      </div>
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
    class="ripple mr-0.5 ml-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full"
  >
    {@render ring()}
  </button>
  <TouchTip anchor={touchTip} within={trigger} onDismiss={hide}>
    {@render detail()}
  </TouchTip>
{:else}
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger onmousedown={holdFocus} class="ripple mr-0.5 ml-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full">
        {@render ring()}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={4} class="z-75 rounded-sm bg-surface-variant px-2 py-1.5 text-body-sm shadow-lg">
          {@render detail()}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
{/if}
