<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import type { Snippet } from "svelte";
  import type { IconSource } from "$lib/ui/icons";
  import { t } from "$lib/i18n/index.svelte";
  import LoadingIndicator from "$lib/ui/LoadingIndicator.svelte";
  import { HEAD_STATUS, HEAD_TONES, type HeadStatus, type HeadTone } from "./headTones";

  interface Props {
    label: string;
    icon?: IconSource;
    leading?: Snippet<[string]>;
    summary?: string;
    summaryTail?: boolean;
    stat?: string | null;
    meta?: Snippet;
    labelOnly?: boolean;
    running?: boolean;
    status?: HeadStatus | null;
    expanded?: boolean;
    tone?: HeadTone;
    onclick?: (() => void) | null;
  }

  const {
    label,
    icon: IconComponent,
    leading,
    summary = "",
    summaryTail = false,
    stat = null,
    meta,
    labelOnly = false,
    running = false,
    status = null,
    expanded = false,
    tone = "process",
    onclick = null,
  }: Props = $props();

  const GLYPH = "size-(--chat-glyph) shrink-0 self-start mt-(--chat-glyph-top)";

  const colors = $derived(HEAD_TONES[tone]);
  const mark = $derived(running || !status ? null : HEAD_STATUS[status]);
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
  {#if summary && summaryTail}
    <span class="flex min-w-0 flex-1 text-block">
      <span class="shrink-0 {colors.label}">{label}</span>
      <span class="ml-2 min-w-0 truncate text-left [direction:rtl] {colors.preview}"><bdi>{summary}</bdi></span>
    </span>
  {:else}
    <span class="min-w-0 flex-1 truncate text-block {summary ? colors.preview : colors.label}"
      ><span class={colors.label}>{label}</span>{#if summary}<span class="ml-2 {colors.preview}">{summary}</span
        >{/if}</span
    >
  {/if}
  {#if meta}
    <span class="flex shrink-0 items-center gap-2 text-body-sm group-data-[stuck]/head:hidden">{@render meta()}</span>
  {/if}
  {#if stat}
    <span class="shrink-0 text-body-sm text-faint group-data-[stuck]/head:hidden">{stat}</span>
  {/if}
  {#if running}
    <LoadingIndicator class="{GLYPH} text-accent group-data-[stuck]/head:hidden" />
  {:else if mark}
    <mark.icon
      class="{GLYPH} {mark.color} group-data-[stuck]/head:hidden"
      role="img"
      aria-label={t(mark.label)}
    />
  {/if}
  {#if !labelOnly}
    {#if expanded}
      <ChevronDown class="{GLYPH} text-faint" />
    {:else}
      <ChevronRight class="{GLYPH} text-faint" />
    {/if}
  {/if}
</button>
