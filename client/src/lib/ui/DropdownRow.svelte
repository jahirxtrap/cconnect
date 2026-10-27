<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";

  interface Props {
    label: string;
    icon?: IconSource;
    leading?: Snippet;
    menu?: boolean;
    class?: string;
  }

  const { label, icon: Icon, leading, menu = true, class: className = "" }: Props = $props();

  const ICON_SIZE = 16;
</script>

<span
  class="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-on-surface-variant {menu
    ? 'cursor-pointer transition-colors hover:bg-hover'
    : ''} {className}"
>
  {#if leading}
    {@render leading()}
  {:else if Icon}
    <Icon size={ICON_SIZE} class="shrink-0" />
  {/if}
  <span class="min-w-0 flex-1 truncate text-left text-item-title text-on-surface">{label}</span>
  {#if menu}
    <ChevronDown size={ICON_SIZE} class="shrink-0" />
  {/if}
</span>
