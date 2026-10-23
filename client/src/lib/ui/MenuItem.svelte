<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";
  import { shortcuts } from "$lib/platform/shortcuts.svelte";
  import type { IconSource } from "./icons";
  import { holdFocus, returnFocus } from "./keepFocus";
  import { MENU_ICON_SIZE, MENU_ITEM_CLASS, menuIconClass } from "./menuSurface";

  interface Props {
    text: string;
    description?: string;
    shortcut?: string;
    icon?: IconSource;
    danger?: boolean;
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
    icon: IconComponent,
    danger = false,
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
  class="{MENU_ITEM_CLASS} {danger ? 'text-red' : ''} data-disabled:cursor-default data-disabled:opacity-40"
>
  {#if IconComponent}
    <IconComponent size={MENU_ICON_SIZE} class={menuIconClass(danger)} />
  {/if}
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
    <Check size={MENU_ICON_SIZE} class="shrink-0 text-accent" />
  {/if}
  {#if hint}
    <span class="shrink-0 pl-4 text-caption text-faint">{hint}</span>
  {/if}
  {@render trailing?.()}
</DropdownMenu.Item>
