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

<Pressable {onclick} {enabled} class="flex w-full items-center px-4 py-2.5 {enabled ? '' : 'opacity-40'}">
  <IconComponent size={24} class="shrink-0 text-accent" />
  <div class="ml-4 min-w-0 flex-1">
    <p class="truncate text-body-lg">{title}</p>
    {#if summary}
      <p class="truncate text-body-sm text-on-surface-variant">{summary}</p>
    {/if}
    {#if alert}
      <p class="text-body-sm text-red">{alert}</p>
    {/if}
  </div>
  {#if trailing}
    <div class="ml-3 shrink-0">{@render trailing()}</div>
  {/if}
</Pressable>
