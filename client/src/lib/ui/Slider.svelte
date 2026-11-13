<script lang="ts">
  import { OWN_SWIPE } from "./swipe";

  interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    enabled?: boolean;
    pending?: boolean;
    showValue?: boolean;
    loaded?: number | null;
    onChange: (value: number) => void;
    class?: string;
  }

  const {
    value,
    min = 0,
    max = 100,
    step = 1,
    enabled = true,
    pending = false,
    showValue = true,
    loaded = null,
    onChange,
    class: className = "",
  }: Props = $props();

  const THUMB = 14;

  const span = $derived(max - min || 1);
  const clamp = (amount: number) => Math.min(Math.max(amount, min), max);
  const reachOf = (amount: number) => `calc((100% - ${THUMB}px) * ${(clamp(amount) - min) / span} + ${THUMB / 2}px)`;
  const clamped = $derived(clamp(value));
  const reach = $derived(reachOf(value));
</script>

<div class="flex items-center gap-3 {className}">
  <div {...OWN_SWIPE} class="relative flex h-4 min-w-0 flex-1 items-center {enabled ? '' : 'opacity-50'}">
    <div class="relative h-1 w-full overflow-hidden rounded-full bg-outline-variant">
      {#if loaded !== null}
        <div class="absolute inset-y-0 left-0 rounded-full bg-faint" style="width: {reachOf(loaded)}"></div>
      {/if}
      <div class="relative h-full rounded-full bg-accent" style="width: {reach}"></div>
    </div>
    <input
      type="range"
      class="cc-range absolute inset-0 w-full touch-pan-y"
      {min}
      {max}
      {step}
      value={clamped}
      disabled={!enabled || pending}
      oninput={(event) => onChange(Number(event.currentTarget.value))}
    />
    <span
      class="cc-thumb pointer-events-none absolute rounded-full bg-accent"
      style="width: {THUMB}px; height: {THUMB}px; left: {reach}; transform: translateX(-50%)"
    ></span>
  </div>
  {#if showValue}
    <span class="min-w-[3ch] shrink-0 text-right text-body-md tabular-nums">{clamped}</span>
  {/if}
</div>

<style>
  .cc-range {
    appearance: none;
    -webkit-appearance: none;
    height: 100%;
    background: transparent;
    opacity: 0;
    cursor: pointer;
  }

  .cc-range:disabled {
    cursor: default;
  }

  .cc-range::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: currentColor;
  }

  .cc-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: none;
    border-radius: 999px;
    background: currentColor;
  }
</style>
