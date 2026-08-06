<script lang="ts">
  import type { IconSource } from "$lib/ui/icons";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    icon: IconSource;
    label: string;
    onclick: () => void;
    enabled?: boolean;
  }

  const { icon: IconComponent, label, onclick, enabled = true }: Props = $props();
</script>

<span class="sm:hidden">
  <TooltipIconButton {label} {onclick} {enabled} class="size-8">
    <IconComponent />
  </TooltipIconButton>
</span>
<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="hidden h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-label-lg transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default disabled:opacity-40 sm:inline-flex"
>
  <IconComponent size={18} class="shrink-0" />
  <span class="truncate">{label}</span>
</button>
