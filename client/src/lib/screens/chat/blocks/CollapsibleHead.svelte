<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";

  interface Props {
    label: string;
    icon?: IconSource;
    summary?: string;
    stat?: string | null;
    meta?: Snippet;
    labelOnly?: boolean;
    running?: boolean;
    expanded?: boolean;
    iconClass?: string;
    onclick?: (() => void) | null;
  }

  const {
    label,
    icon: IconComponent,
    summary = "",
    stat = null,
    meta,
    labelOnly = false,
    running = false,
    expanded = false,
    iconClass = "text-accent",
    onclick = null,
  }: Props = $props();

  const GLYPH = 14;
</script>

<button
  type="button"
  disabled={labelOnly}
  onclick={() => onclick?.()}
  class="flex h-7 w-full items-center gap-2 px-2.5 text-left transition-colors select-none {labelOnly
    ? 'cursor-default'
    : 'cursor-pointer hover:bg-hover'}"
>
  {#if IconComponent}
    <IconComponent size={GLYPH} class="shrink-0 {iconClass}" />
  {/if}
  <span class="min-w-0 truncate text-block {summary ? 'text-on-surface-variant' : 'text-on-surface'}"
    ><span class="text-on-surface">{label}</span>{#if summary}<span class="ml-2 text-on-surface-variant">{summary}</span
      >{/if}</span
  >
  <span class="min-w-2 flex-1"></span>
  {#if meta}
    <span class="flex shrink-0 items-center gap-2 text-body-sm group-data-[stuck]/head:hidden">{@render meta()}</span>
  {/if}
  {#if stat}
    <span class="shrink-0 text-body-sm text-faint group-data-[stuck]/head:hidden">{stat}</span>
  {/if}
  {#if running}
    <LoadingIndicator size={14} class="shrink-0 text-accent group-data-[stuck]/head:hidden" />
  {/if}
  {#if !labelOnly}
    {#if expanded}
      <ChevronDown size={GLYPH} class="shrink-0 text-faint" />
    {:else}
      <ChevronRight size={GLYPH} class="shrink-0 text-faint" />
    {/if}
  {/if}
</button>
