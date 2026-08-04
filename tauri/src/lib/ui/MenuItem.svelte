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
  class="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors outline-none select-none data-highlighted:bg-on-surface/10 data-disabled:cursor-default data-disabled:opacity-40"
>
  {@render leading?.()}
  <span class="min-w-0 flex-1 truncate text-body-md {textClass}">{text}</span>
  {#if selected}
    <Check size={16} class="shrink-0 text-accent" />
  {/if}
  {@render trailing?.()}
</DropdownMenu.Item>
