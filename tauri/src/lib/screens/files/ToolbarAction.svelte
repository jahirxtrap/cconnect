<script lang="ts">
  import type { IconSource } from "$lib/ui/icons";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    icon: IconSource;
    label: string;
    onclick: () => void;
    enabled?: boolean;
    narrow?: boolean;
    shortcut?: string;
  }

  const {
    icon: IconComponent,
    label,
    onclick,
    enabled = true,
    narrow = false,
    shortcut,
  }: Props = $props();
</script>

{#if narrow}
  <TooltipIconButton {label} {shortcut} {onclick} {enabled} class="size-8 [&_svg]:size-5">
    <IconComponent />
  </TooltipIconButton>
{:else}
  <button
    type="button"
    disabled={!enabled}
    {onclick}
    class="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-label-lg whitespace-nowrap transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40"
  >
    <IconComponent size={18} class="shrink-0" />
    <span class="truncate">{label}</span>
  </button>
{/if}
