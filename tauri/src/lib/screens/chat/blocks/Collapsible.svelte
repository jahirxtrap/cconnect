<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";

  interface Props {
    label: string;
    icon?: IconSource;
    preview?: string | null;
    stat?: string | null;
    labelOnly?: boolean;
    running?: boolean;
    labelClass?: string;
    iconClass?: string;
    bodyClass?: string;
    expanded?: boolean | null;
    onToggle?: (() => void) | null;
    children?: Snippet;
  }

  const {
    label,
    icon: IconComponent,
    preview = null,
    stat = null,
    labelOnly = false,
    running = false,
    labelClass = "text-on-surface-variant",
    iconClass = "text-accent",
    bodyClass = "mt-1",
    expanded = null,
    onToggle = null,
    children,
  }: Props = $props();

  let localExpanded = $state(false);

  const isExpanded = $derived(expanded ?? localExpanded);

  const summary = $derived(isExpanded ? "" : (preview ?? "").replace(/\s+/g, " ").trim());

  const toggle = () => {
    if (onToggle) onToggle();
    else localExpanded = !localExpanded;
  };
</script>

<div class="w-full px-4">
  <button
    type="button"
    disabled={labelOnly}
    onclick={toggle}
    class="flex w-full items-center rounded-sm text-left transition-colors select-none {labelOnly
      ? 'cursor-default'
      : 'cursor-pointer hover:bg-on-surface/8'}"
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
      {#if isExpanded}
        <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={18} class="shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  </button>
  {#if isExpanded && children && !labelOnly}
    <div class={bodyClass}>{@render children()}</div>
  {/if}
</div>
