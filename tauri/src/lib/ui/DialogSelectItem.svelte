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
    trailing?: Snippet;
  }

  const {
    label,
    selected,
    onclick,
    subtitle,
    enabled = true,
    mono = false,
    trailing,
  }: Props = $props();
</script>

<div class="px-5">
  <Pressable
    {onclick}
    {enabled}
    class="flex w-full items-center gap-3 rounded-sm px-2 py-2 {selected ? 'bg-on-surface/8' : ''} {enabled
      ? ''
      : 'opacity-40'}"
  >
    <SelectionDot {selected} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-body-md {mono ? 'font-mono' : ''}">{label}</p>
      {#if subtitle}
        <p class="truncate text-body-sm text-on-surface-variant">{subtitle}</p>
      {/if}
    </div>
    {@render trailing?.()}
  </Pressable>
</div>
