<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { IconSource } from "$lib/ui/icons";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";

  interface Props {
    label: string;
    icon?: IconSource;
    summary?: string;
    stat?: string | null;
    labelOnly?: boolean;
    running?: boolean;
    expanded?: boolean;
    labelClass?: string;
    iconClass?: string;
    wide?: boolean;
    onclick?: (() => void) | null;
  }

  const {
    label,
    icon: IconComponent,
    summary = "",
    stat = null,
    labelOnly = false,
    running = false,
    expanded = false,
    labelClass = "text-on-surface-variant",
    iconClass = "text-accent",
    wide = false,
    onclick = null,
  }: Props = $props();
</script>

<button
  type="button"
  disabled={labelOnly}
  onclick={() => onclick?.()}
  class="flex w-full items-center text-left transition-colors select-none {wide
    ? 'px-4'
    : 'rounded-sm'} {labelOnly ? 'cursor-default' : 'cursor-pointer hover:bg-on-surface/8'}"
>
  {#if IconComponent}
    <IconComponent size={16} class="mr-[6px] shrink-0 {iconClass}" />
  {/if}
  <span class="min-w-0 truncate text-label-lg text-on-surface-variant"><span
      class={labelClass}>{label}</span>{#if summary}<span class="ml-1.5 text-on-surface-variant"
      >{summary}</span
    >{/if}</span>
  <span class="min-w-2 flex-1"></span>
  {#if stat}
    <span class="mr-1.5 shrink-0 text-body-sm text-on-surface-variant">{stat}</span>
  {/if}
  {#if running}
    <LoadingIndicator size={16} class="text-accent {labelOnly ? '' : 'mr-0.5'}" />
  {/if}
  {#if !labelOnly}
    {#if expanded}
      <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
    {:else}
      <ChevronRight size={18} class="shrink-0 text-on-surface-variant" />
    {/if}
  {/if}
</button>
