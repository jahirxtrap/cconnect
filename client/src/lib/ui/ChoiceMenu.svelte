<script lang="ts">
  import type { IconSource } from "./icons";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import type { SelectOption } from "./SelectDialog.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  interface Props {
    label: string;
    icon: IconSource;
    options: SelectOption[];
    selected: string;
    onSelect: (value: string) => void;
    empty?: string | null;
    enabled?: boolean;
  }

  const { label, icon: IconComponent, options, selected, onSelect, empty = null, enabled = true }: Props = $props();

  let open = $state(false);
</script>

<PopupMenu {open} {label} onOpenChange={(value) => (open = value)}>
  {#snippet triggerChild(props)}
    <TooltipIconButton {label} {enabled} {...props}>
      <IconComponent />
    </TooltipIconButton>
  {/snippet}
  {#each options as option (option.value)}
    <MenuItem
      text={option.label}
      description={option.subtitle ?? undefined}
      selected={option.value === selected}
      onclick={() => onSelect(option.value)}
    />
  {:else}
    {#if empty}
      <MenuItem text={empty} enabled={false} />
    {/if}
  {/each}
</PopupMenu>
