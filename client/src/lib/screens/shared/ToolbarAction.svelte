<script lang="ts">
  import Button from "$lib/ui/Button.svelte";
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
  <TooltipIconButton {label} {shortcut} {onclick} {enabled}>
    <IconComponent />
  </TooltipIconButton>
{:else}
  <Button variant="ghost" {onclick} {enabled}>
    <IconComponent size={16} class="shrink-0" />
    <span class="truncate">{label}</span>
  </Button>
{/if}
