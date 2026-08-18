<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import type { SelectOption } from "./SelectDialog.svelte";

  interface Props {
    label: string;
    selected: string;
    options?: SelectOption[];
    enabled?: boolean;
    onSelect?: (value: string) => void;
    onclick?: (() => void) | null;
    class?: string;
    trailing?: Snippet;
  }

  const {
    label,
    selected,
    options = [],
    enabled = true,
    onSelect,
    onclick = null,
    class: className = "",
    trailing,
  }: Props = $props();

  let open = $state(false);
  const display = $derived(options.find((option) => option.value === selected)?.label ?? selected);

  const FIELD_CLASS = "flex w-full items-center rounded-md border-2 px-3 py-2 transition-colors";
</script>

<div class={className}>
  <p class="mb-1.5 text-label-lg">{label}</p>
  {#snippet field(active: boolean)}
    <span class="{FIELD_CLASS} {enabled ? 'cursor-pointer' : ''} {active ? 'border-accent' : 'border-outline-variant'}">
      <span class="min-w-0 flex-1 truncate text-left text-body-md">{display}</span>
      {#if trailing}
        <span class="ml-2 flex shrink-0 items-center">{@render trailing()}</span>
      {/if}
      {#if enabled}
        <ChevronDown size={24} class="ml-2 shrink-0 text-on-surface-variant" />
      {/if}
    </span>
  {/snippet}
  {#if onclick}
    <button type="button" disabled={!enabled} {onclick} class="w-full">
      {@render field(false)}
    </button>
  {:else}
    <PopupMenu {open} matchTriggerWidth triggerClass="w-full" onOpenChange={(value) => (open = value)}>
      {#snippet trigger()}
        {@render field(open)}
      {/snippet}
      {#each options as option (option.value)}
        <MenuItem
          text={option.label}
          selected={option.value === selected}
          onclick={() => {
            onSelect?.(option.value);
            open = false;
          }}
        />
      {/each}
    </PopupMenu>
  {/if}
</div>
