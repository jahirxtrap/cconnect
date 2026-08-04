<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { DropdownMenu } from "bits-ui";
  import type { Snippet } from "svelte";

  interface Props {
    text: string;
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
    onclick,
    selected = false,
    enabled = true,
    closeOnSelect = true,
    textClass = "",
    leading,
    trailing,
  }: Props = $props();
</script>

<DropdownMenu.Item
  disabled={!enabled}
  {closeOnSelect}
  onSelect={onclick}
  class="flex w-full cursor-pointer items-center px-3.5 py-1.5 text-left transition-colors outline-none data-highlighted:bg-on-surface/8 data-disabled:cursor-default data-disabled:opacity-40"
>
  {#if leading}
    <div class="mr-2.5 shrink-0">{@render leading()}</div>
  {/if}
  <span class="min-w-0 flex-1 truncate text-body-md {textClass}">{text}</span>
  {#if selected}
    <Check size={20} class="ml-2.5 shrink-0 text-accent" />
  {/if}
  {#if trailing}
    <div class="ml-2.5 shrink-0">{@render trailing()}</div>
  {/if}
</DropdownMenu.Item>
