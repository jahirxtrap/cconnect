<script lang="ts">
  import { BAR_ACTION_CLASS } from "$lib/ui/actionBar";
  import Button from "$lib/ui/Button.svelte";
  import type { IconSource } from "$lib/ui/icons";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";

  interface Props {
    icon: IconSource;
    label: string;
    onclick: () => void;
    enabled?: boolean;
    narrow?: boolean;
    danger?: boolean;
    shortcut?: string;
  }

  const {
    icon: IconComponent,
    label,
    onclick,
    enabled = true,
    narrow = false,
    danger = false,
    shortcut,
  }: Props = $props();

  const tone = $derived(danger ? "text-red" : "");
</script>

{#if narrow}
  <TooltipIconButton {label} {shortcut} {onclick} {enabled} class={BAR_ACTION_CLASS}>
    <IconComponent class={tone} />
  </TooltipIconButton>
{:else}
  <Button variant="ghost" {onclick} {enabled}>
    <IconComponent size={16} class="shrink-0 {tone}" />
    <span class="truncate {tone}">{label}</span>
  </Button>
{/if}
