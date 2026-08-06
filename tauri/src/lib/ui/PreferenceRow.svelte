<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    icon: IconSource;
    title: string;
    summary?: string | null;
    alert?: string | null;
    enabled?: boolean;
    onclick?: () => void;
    trailing?: Snippet;
  }

  const {
    icon: IconComponent,
    title,
    summary,
    alert,
    enabled = true,
    onclick,
    trailing,
  }: Props = $props();
</script>

<Pressable {onclick} {enabled} class="flex w-full items-center gap-3 px-4 py-3 {enabled ? '' : 'opacity-40'}">
  <IconComponent size={18} class="shrink-0 text-on-surface-variant" />
  <div class="min-w-0 flex-1">
    <p class="truncate text-body-md font-medium">{title}</p>
    {#if summary}
      <p class="truncate text-body-sm text-on-surface-variant">{summary}</p>
    {/if}
    {#if alert}
      <p class="text-body-sm text-red">{alert}</p>
    {/if}
  </div>
  {#if trailing}
    <div class="flex shrink-0 items-center gap-1">{@render trailing()}</div>
  {/if}
</Pressable>
