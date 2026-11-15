<script module lang="ts">
  export const TAG_CLASS = "flex h-5 shrink-0 items-center rounded-sm bg-accent-soft px-1.5 text-caption text-accent";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "$lib/i18n/index.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import { REPAINT_EDGE_CLASS } from "$lib/ui/field";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  export interface CardProgress {
    text: string;
    loading: boolean;
    tone: string;
  }

  interface Props {
    title: string;
    tag?: string | null;
    enabled?: boolean | null;
    progress?: CardProgress | null;
    source?: string | null;
    description?: string | null;
    selected?: boolean;
    leading?: Snippet;
    onclick: () => void;
  }

  const {
    title,
    tag = null,
    enabled = null,
    progress = null,
    source = null,
    description = null,
    selected = false,
    leading,
    onclick,
  }: Props = $props();
</script>

{#snippet body()}
  <span class="flex min-w-0 items-center gap-2">
    <span class="min-w-0 truncate text-label-lg">{title}</span>
    {#if tag}
      <span class={TAG_CLASS}>{tag}</span>
    {/if}
    {#if progress}
      <span class="ml-auto flex shrink-0 items-center gap-1.5 text-caption text-faint">
        <StatusDot class={progress.tone} loading={progress.loading} />
        {progress.text}
      </span>
    {:else if enabled !== null}
      <span class="ml-auto flex shrink-0 items-center gap-1.5 text-caption text-faint">
        <StatusDot class={enabled ? "bg-green" : "bg-faint"} />
        {t(enabled ? "OPTION_ON" : "OPTION_OFF")}
      </span>
    {/if}
  </span>
  {#if source}
    <span class="truncate text-caption text-faint">{source}</span>
  {/if}
  {#if description}
    <span class="line-clamp-2 wrap-anywhere text-body-sm text-on-surface-variant">{description}</span>
  {/if}
{/snippet}

<CardPanel {onclick} class="min-w-0 gap-1.5 {REPAINT_EDGE_CLASS} {selected ? 'ring-(length:--hairline) ring-accent-ring ring-inset' : ''}">
  {#if leading}
    <span class="flex min-w-0 items-center gap-3">
      {@render leading()}
      <span class="flex min-w-0 flex-1 flex-col gap-1.5">
        {@render body()}
      </span>
    </span>
  {:else}
    {@render body()}
  {/if}
</CardPanel>
