<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";

  interface Props {
    label: string;
    icon?: IconSource;
    preview?: string | null;
    labelOnly?: boolean;
    running?: boolean;
    labelClass?: string;
    iconClass?: string;
    children?: Snippet;
  }

  const {
    label,
    icon: IconComponent,
    preview = null,
    labelOnly = false,
    running = false,
    labelClass = "text-on-surface-variant",
    iconClass = "text-accent",
    children,
  }: Props = $props();

  let expanded = $state(false);
  let header = $state<HTMLElement | null>(null);

  const summary = $derived(expanded ? "" : (preview ?? "").replace(/\s+/g, " ").trim());

  const toggle = () => {
    const stuck = !!header && header.getBoundingClientRect().top <= header.offsetTop;
    expanded = !expanded;
    if (!expanded && stuck) header?.scrollIntoView({ block: "start" });
  };
</script>

<div class="w-full px-4">
  <button
    bind:this={header}
    type="button"
    disabled={labelOnly}
    onclick={toggle}
    class="flex w-full items-center gap-[6px] text-left transition-colors select-none {labelOnly
      ? 'cursor-default'
      : 'cursor-pointer hover:bg-on-surface/8'} {expanded ? 'sticky top-0 z-10 bg-background' : ''}"
  >
    {#if IconComponent}
      <IconComponent size={16} class="shrink-0 {iconClass}" />
    {/if}
    <span class="min-w-0 flex-1 truncate text-label-lg text-on-surface-variant">
      <span class={labelClass}>{label}</span>
      {#if summary}
        <span class="ml-1.5 font-normal text-on-surface-variant">{summary}</span>
      {/if}
    </span>
    {#if running}
      <span class="size-4 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent"></span>
    {/if}
    {#if !labelOnly}
      {#if expanded}
        <ChevronDown size={18} class="shrink-0 text-on-surface-variant" />
      {:else}
        <ChevronRight size={18} class="shrink-0 text-on-surface-variant" />
      {/if}
    {/if}
  </button>
  {#if expanded && children}
    <div class="mt-1">{@render children()}</div>
  {/if}
</div>
