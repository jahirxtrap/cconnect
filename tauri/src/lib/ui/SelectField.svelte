<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import type { SelectOption } from "./SelectDialog.svelte";

  interface Props {
    label: string;
    selected: string;
    options: SelectOption[];
    onSelect: (value: string) => void;
    class?: string;
  }

  const { label, selected, options, onSelect, class: className = "" }: Props = $props();

  let open = $state(false);
  const display = $derived(options.find((option) => option.value === selected)?.label ?? selected);
</script>

<div class={className}>
  <p class="mb-1.5 text-label-lg">{label}</p>
  <PopupMenu {open} matchTriggerWidth triggerClass="w-full" onOpenChange={(value) => (open = value)}>
    {#snippet trigger()}
      <span
        class="flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors {open
          ? 'border-accent'
          : 'border-outline-variant'}"
      >
        <span class="min-w-0 flex-1 truncate text-left text-body-md">{display}</span>
        <ChevronDown size={16} class="shrink-0 text-on-surface-variant" />
      </span>
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
</div>
