<script module lang="ts">
  export const TAG_CLASS = "flex h-5 shrink-0 items-center rounded-sm bg-accent-soft px-1.5 text-caption text-accent";
</script>

<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import CardPanel from "$lib/ui/CardPanel.svelte";
  import StatusDot from "$lib/ui/StatusDot.svelte";

  interface Props {
    title: string;
    tag?: string | null;
    enabled?: boolean | null;
    source?: string | null;
    description?: string | null;
    selected?: boolean;
    onclick: () => void;
  }

  const {
    title,
    tag = null,
    enabled = null,
    source = null,
    description = null,
    selected = false,
    onclick,
  }: Props = $props();
</script>

<CardPanel {onclick} class="min-w-0 gap-1.5 {selected ? 'ring-1 ring-accent-ring ring-inset' : ''}">
  <span class="flex min-w-0 items-center gap-2">
    <span class="min-w-0 truncate text-label-lg">{title}</span>
    {#if tag}
      <span class={TAG_CLASS}>{tag}</span>
    {/if}
    {#if enabled !== null}
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
    <span class="line-clamp-2 text-body-sm text-on-surface-variant">{description}</span>
  {/if}
</CardPanel>
