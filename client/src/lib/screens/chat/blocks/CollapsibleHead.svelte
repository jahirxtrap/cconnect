<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import { HEAD_TONES, type HeadTone } from "./headTones";

  interface Props {
    label: string;
    icon?: IconSource;
    leading?: Snippet<[string]>;
    summary?: string;
    stat?: string | null;
    meta?: Snippet;
    labelOnly?: boolean;
    running?: boolean;
    expanded?: boolean;
    tone?: HeadTone;
    onclick?: (() => void) | null;
  }

  const {
    label,
    icon: IconComponent,
    leading,
    summary = "",
    stat = null,
    meta,
    labelOnly = false,
    running = false,
    expanded = false,
    tone = "process",
    onclick = null,
  }: Props = $props();

  const GLYPH = "size-(--chat-glyph) shrink-0 self-start mt-(--chat-glyph-top)";

  const colors = $derived(HEAD_TONES[tone]);
</script>

<button
  type="button"
  disabled={labelOnly}
  onclick={() => onclick?.()}
  class="flex h-(--chat-head) w-full items-center gap-2 px-2.5 text-left transition-colors select-none {labelOnly
    ? 'cursor-default'
    : 'cursor-pointer hover:bg-hover'}"
>
  {#if leading}
    {@render leading(`${GLYPH} ${colors.icon}`)}
  {:else if IconComponent}
    <IconComponent class="{GLYPH} {colors.icon}" />
  {/if}
  <span class="min-w-0 flex-1 truncate text-block {summary ? colors.preview : colors.label}"
    ><span class={colors.label}>{label}</span>{#if summary}<span class="ml-2 {colors.preview}">{summary}</span
      >{/if}</span
  >
  {#if meta}
    <span class="flex shrink-0 items-center gap-2 text-body-sm group-data-[stuck]/head:hidden">{@render meta()}</span>
  {/if}
  {#if stat}
    <span class="shrink-0 text-body-sm text-faint group-data-[stuck]/head:hidden">{stat}</span>
  {/if}
  {#if running}
    <LoadingIndicator class="{GLYPH} text-accent group-data-[stuck]/head:hidden" />
  {/if}
  {#if !labelOnly}
    {#if expanded}
      <ChevronDown class="{GLYPH} text-faint" />
    {:else}
      <ChevronRight class="{GLYPH} text-faint" />
    {/if}
  {/if}
</button>
