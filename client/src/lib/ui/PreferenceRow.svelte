<script lang="ts">
  import type { Snippet } from "svelte";
  import ErrorText from "./ErrorText.svelte";
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";
  import { PREFERENCE_ICON_SIZE, PREFERENCE_ROW_CLASS } from "./preferenceRow";

  interface Props {
    icon: IconSource;
    title: string;
    summary?: string | null;
    alert?: string | null;
    enabled?: boolean;
    flash?: boolean;
    onclick?: () => void;
    trailing?: Snippet;
  }

  const {
    icon: IconComponent,
    title,
    summary,
    alert,
    enabled = true,
    flash = false,
    onclick,
    trailing,
  }: Props = $props();
</script>

<Pressable
  {onclick}
  {enabled}
  class="{PREFERENCE_ROW_CLASS} {enabled ? '' : 'opacity-40'} {flash ? 'flash-highlight' : ''}"
>
  <IconComponent size={PREFERENCE_ICON_SIZE} class="shrink-0 text-on-surface-variant" />
  <div class="min-w-0 flex-1">
    <p class="truncate text-item-title">{title}</p>
    {#if summary}
      <p class="truncate text-body-sm text-on-surface-variant">{summary}</p>
    {/if}
    {#if alert}
      <ErrorText text={alert} />
    {/if}
  </div>
  {#if trailing}
    <div class="flex shrink-0 items-center">{@render trailing()}</div>
  {/if}
</Pressable>
