<script lang="ts">
  interface Props {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    enabled?: boolean;
    showValue?: boolean;
    onChange: (value: number) => void;
    class?: string;
  }

  const {
    value,
    min = 0,
    max = 100,
    step = 1,
    enabled = true,
    showValue = true,
    onChange,
    class: className = "",
  }: Props = $props();

  const THUMB = 14;

  const span = $derived(max - min || 1);
  const clamped = $derived(Math.min(Math.max(value, min), max));
  const fill = $derived((clamped - min) / span);
  const reach = $derived(`calc((100% - ${THUMB}px) * ${fill} + ${THUMB / 2}px)`);
</script>

<div class="flex items-center gap-3 {className}">
  <div class="relative flex h-4 min-w-0 flex-1 items-center {enabled ? '' : 'opacity-50'}">
    <div class="h-1 w-full overflow-hidden rounded-full bg-outline-variant">
      <div class="h-full rounded-full bg-accent" style="width: {reach}"></div>
    </div>
    <input
      type="range"
      class="cc-range absolute inset-0 w-full"
      {min}
      {max}
      {step}
      value={clamped}
      disabled={!enabled}
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

  .cc-range:focus-visible ~ .cc-thumb {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
