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
    shown?: string | null;
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
    shown = null,
    onSelect,
    onclick = null,
    class: className = "",
    trailing,
  }: Props = $props();

  const ACTIONS_GAP = 8;

  let open = $state(false);
  let actionsWidth = $state(0);

  const display = $derived(shown ?? options.find((option) => option.value === selected)?.label ?? selected);
  const actionsReserve = $derived(
    actionsWidth ? `margin-right: ${actionsWidth + ACTIONS_GAP}px` : "",
  );

  const FIELD_CLASS =
    "relative flex w-full items-center rounded-md border-2 px-3 py-2 transition-colors";
</script>

<div class={className}>
  <p class="mb-1.5 text-label-lg">{label}</p>
  {#snippet field(active: boolean)}
    <span class="{FIELD_CLASS} {enabled ? 'cursor-pointer' : ''} {active ? 'border-accent' : 'border-outline-variant'}">
      <span style={actionsReserve} class="min-w-0 flex-1 truncate text-left text-body-md">
        {display}
      </span>
      <span
        bind:clientWidth={actionsWidth}
        class="absolute inset-y-0 right-3 flex items-center gap-2"
      >
        {@render trailing?.()}
        {#if enabled}
          <ChevronDown size={24} class="shrink-0 text-on-surface-variant" />
        {/if}
      </span>
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
