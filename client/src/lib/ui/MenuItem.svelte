<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import { shortcuts } from "$lib/platform/shortcuts.svelte";
  import { holdFocus, returnFocus } from "./keepFocus";

  interface Props {
    text: string;
    description?: string;
    shortcut?: string;
    onclick?: () => void;
    selected?: boolean;
    enabled?: boolean;
    closeOnSelect?: boolean;
    textClass?: string;
    leading?: Snippet;
    trailing?: Snippet;
  }

  const {
    text,
    description = "",
    shortcut,
    onclick,
    selected = false,
    enabled = true,
    closeOnSelect = true,
    textClass = "",
    leading,
    trailing,
  }: Props = $props();

  const hint = $derived(shortcut ? shortcuts.hint(shortcut) : "");
</script>

<DropdownMenu.Item
  disabled={!enabled}
  aria-keyshortcuts={shortcut ? shortcuts.aria(shortcut) : undefined}
  {closeOnSelect}
  onSelect={onclick}
  onmousedown={holdFocus}
  onfocusin={returnFocus}
  class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors outline-none select-none data-disabled:cursor-default data-disabled:opacity-40"
>
  {@render leading?.()}
  {#if description}
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-body-md {textClass}">{text}</span>
      <span class="truncate text-body-sm text-on-surface-variant">{description}</span>
    </span>
  {:else}
    <span class="min-w-0 flex-1 truncate text-body-md {textClass}">{text}</span>
  {/if}
  {#if selected}
    <Check size={16} class="shrink-0 text-accent" />
  {/if}
  {#if hint}
    <span class="shrink-0 pl-4 text-body-sm text-on-surface-variant">{hint}</span>
  {/if}
  {@render trailing?.()}
</DropdownMenu.Item>
