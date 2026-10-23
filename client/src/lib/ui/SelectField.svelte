<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";
  import MenuItem from "./MenuItem.svelte";
  import PopupMenu from "./PopupMenu.svelte";
  import { FIELD_ACTIONS_CLASS, FIELD_ACTIONS_GAP, FIELD_BOX_CLASS, FIELD_LABEL_CLASS } from "./field";
  import type { SelectOption } from "./SelectDialog.svelte";
  import TrailingIcon from "./TrailingIcon.svelte";

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

  let open = $state(false);
  let actionsWidth = $state(0);

  const display = $derived(shown ?? options.find((option) => option.value === selected)?.label ?? selected);
  const actionsReserve = $derived(
    actionsWidth ? `margin-right: ${actionsWidth + FIELD_ACTIONS_GAP}px` : "",
  );
</script>

<div class="{enabled ? '' : 'opacity-40'} {className}">
  {#if label}
    <p class={FIELD_LABEL_CLASS}>{label}</p>
  {/if}
  {#snippet field()}
    <span
      class="{FIELD_BOX_CLASS} {enabled ? 'cursor-pointer' : ''} ring-transparent group-data-[state=open]:ring-accent"
    >
      <span style={actionsReserve} class="min-w-0 flex-1 truncate text-left text-body-md">
        {display}
      </span>
      <span
        bind:clientWidth={actionsWidth}
        class={FIELD_ACTIONS_CLASS}
      >
        {@render trailing?.()}
        {#if enabled}
          <TrailingIcon icon={ChevronDown} />
        {/if}
      </span>
    </span>
  {/snippet}
  {#if onclick}
    <button type="button" disabled={!enabled} {onclick} class="w-full">
      {@render field()}
    </button>
  {:else if !enabled}
    {@render field()}
  {:else}
    <PopupMenu
      {open}
      matchTriggerWidth
      triggerClass="group w-full"
      onOpenChange={(value) => (open = value)}
    >
      {#snippet trigger()}
        {@render field()}
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
