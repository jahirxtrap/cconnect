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

<Pressable {onclick} {enabled} class="flex w-full items-center px-5 py-2.5 {enabled ? '' : 'opacity-40'}">
  {#if IconComponent}
    <IconComponent size={20} class="mr-3.5 shrink-0" />
  {/if}
  <span class="truncate text-body-md">{text}</span>
</Pressable>
