<script lang="ts">
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    title: string;
    value: string;
    own: number;
    rest: number;
    ownLabel: string;
    restLabel: string;
  }

  const { title, value, own, rest, ownLabel, restLabel }: Props = $props();

  const PERCENT = 100;
  const OWN_CLASS = "bg-accent";
  const REST_CLASS = "bg-faint";

  const clamp = (fraction: number) => Math.min(1, Math.max(0, fraction));
  const ownWidth = $derived(clamp(own) * PERCENT);
  const restWidth = $derived(Math.min(clamp(rest) * PERCENT, PERCENT - ownWidth));
  const filled = $derived(ownWidth + restWidth);
  const ownShare = $derived(filled ? (ownWidth / filled) * PERCENT : 0);
</script>

<div class="w-full">
  <div class="flex items-center">
    <p class="min-w-0 flex-1 text-item-title">{title}</p>
    <p class="ml-3 shrink-0 text-body-md tabular-nums">{value}</p>
  </div>
  <div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-outline-variant">
    <div class="flex h-full overflow-hidden rounded-full transition-[width]" style="width: {filled}%">
      <span class="block h-full shrink-0 transition-[width] {OWN_CLASS}" style="width: {ownShare}%"></span>
      <span class="block h-full min-w-0 flex-1 {REST_CLASS}"></span>
    </div>
  </div>
  <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-on-surface-variant">
    <span class="flex min-w-0 items-center gap-1.5">
      <StatusDot class={OWN_CLASS} />
      <span class="truncate tabular-nums">{ownLabel}</span>
    </span>
    <span class="flex min-w-0 items-center gap-1.5">
      <StatusDot class={REST_CLASS} />
      <span class="truncate tabular-nums">{restLabel}</span>
    </span>
  </div>
</div>
