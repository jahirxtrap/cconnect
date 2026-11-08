<script lang="ts">
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import type { IconSource } from "./icons";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import { PREFERENCE_ICON_SIZE, PREFERENCE_ROW_CLASS } from "./preferenceRow";
  import type { SelectOption } from "./SelectDialog.svelte";

  interface Props {
    icon: IconSource;
    title: string;
    options: SelectOption[];
    selected: string;
    onSelect: (value: string) => void;
    enabled?: boolean;
    flash?: boolean;
  }

  const { icon: IconComponent, title, options, selected, onSelect, enabled = true, flash = false }: Props = $props();

  let open = $state(false);

  const shown = $derived(options.find((option) => option.value === selected)?.label ?? selected);
</script>

<PopupMenu {open} label={title} align="end" onOpenChange={(value) => (open = value)} triggerChild={row}>
  {#each options as option (option.value)}
    <MenuItem
      text={option.label}
      selected={option.value === selected}
      onclick={() => {
        onSelect(option.value);
        open = false;
      }}
    />
  {/each}
</PopupMenu>

{#snippet row(props: Record<string, unknown>)}
  <button
    {...props}
    type="button"
    disabled={!enabled}
    class="{PREFERENCE_ROW_CLASS} cursor-pointer text-left transition-colors enabled:hover:bg-hover disabled:cursor-default disabled:opacity-40 {flash
      ? 'flash-highlight'
      : ''}"
  >
    <IconComponent size={PREFERENCE_ICON_SIZE} class="shrink-0 text-on-surface-variant" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-item-title">{title}</span>
      <span class="block truncate text-body-sm text-on-surface-variant">{shown}</span>
    </span>
    <ChevronsUpDown size={16} class="shrink-0 text-on-surface-variant" />
  </button>
{/snippet}
