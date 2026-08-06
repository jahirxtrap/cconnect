<script lang="ts">
  import type { Snippet } from "svelte";
  import Pressable from "./Pressable.svelte";
  import SelectionDot from "./SelectionDot.svelte";

  interface Props {
    label: string;
    selected: boolean;
    onclick: () => void;
    subtitle?: string | null;
    enabled?: boolean;
    mono?: boolean;
    labelFont?: string | null;
    trailing?: Snippet;
  }

  const {
    label,
    selected,
    onclick,
    subtitle,
    enabled = true,
    mono = false,
    labelFont = null,
    trailing,
  }: Props = $props();
</script>

<div class="px-5">
  <Pressable
    {onclick}
    {enabled}
    hover={false}
    class="flex w-full items-center gap-3 rounded-sm py-3 pl-3 {trailing ? 'pr-1' : 'pr-3'} {selected
      ? 'bg-accent/14 enabled:hover:bg-accent/21'
      : 'enabled:hover:bg-on-surface/8'} {enabled ? '' : 'opacity-40'}"
  >
    <SelectionDot {selected} />
    <div class="min-w-0 flex-1">
      <p
        class="truncate text-label-lg {mono ? 'font-mono' : ''} {selected
          ? 'text-accent'
          : 'text-on-surface'}"
        style={labelFont ? `font-family: ${labelFont}` : undefined}
      >
        {label}
      </p>
      {#if subtitle}
        <p class="truncate text-body-sm text-on-surface-variant">{subtitle}</p>
      {/if}
    </div>
    {#if trailing}
      <div class="flex shrink-0 items-center gap-1">{@render trailing()}</div>
    {/if}
  </Pressable>
</div>
