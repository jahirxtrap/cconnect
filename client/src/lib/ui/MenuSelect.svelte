<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import type { SelectOption } from "./SelectDialog.svelte";

  interface Props {
    label: string;
    options: SelectOption[];
    selected: string;
    onSelect: (value: string) => void;
  }

  const { label, options, selected, onSelect }: Props = $props();

  let open = $state(false);

  const shown = $derived(options.find((option) => option.value === selected)?.label ?? selected);
</script>

<PopupMenu
  {open}
  {label}
  align="end"
  triggerClass="ripple inline-flex h-7 max-w-48 min-w-0 cursor-pointer items-center gap-1 rounded-full bg-surface-variant pr-2 pl-3 text-body-sm text-on-surface select-none"
  onOpenChange={(value) => (open = value)}
>
  {#snippet trigger()}
    <span class="truncate">{shown}</span>
    <ChevronDown size={14} class="shrink-0 text-on-surface-variant" />
  {/snippet}
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
