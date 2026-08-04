<script lang="ts">
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    text: string;
    onclick: () => void;
    icon?: IconSource;
    enabled?: boolean;
  }

  const { text, onclick, icon: IconComponent, enabled = true }: Props = $props();
</script>

<div class="px-5">
  <Pressable
    {onclick}
    {enabled}
    class="flex w-full items-center gap-3 rounded-sm px-2 py-2 {enabled ? '' : 'opacity-40'}"
  >
    {#if IconComponent}
      <IconComponent size={16} class="shrink-0 text-on-surface-variant" />
    {/if}
    <span class="truncate text-body-md">{text}</span>
  </Pressable>
</div>
