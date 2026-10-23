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

<div>
  <Pressable
    {onclick}
    {enabled}
    class="flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 {enabled ? '' : 'opacity-40'}"
  >
    {#if IconComponent}
      <IconComponent size={18} class="shrink-0 text-on-surface-variant" />
    {/if}
    <span class="truncate text-body-md">{text}</span>
  </Pressable>
</div>
