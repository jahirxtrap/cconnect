<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    icon: IconSource;
    title: string;
    subtitle?: string | null;
    iconClass?: string;
    onclick?: () => void;
    onlongclick?: () => void;
    class?: string;
    leading?: Snippet;
    subtitleTrailing?: Snippet;
    trailing?: Snippet;
  }

  const {
    icon: IconComponent,
    title,
    subtitle,
    iconClass = "text-accent",
    onclick,
    onlongclick,
    class: className = "",
    leading,
    subtitleTrailing,
    trailing,
  }: Props = $props();
</script>

<Pressable {onclick} {onlongclick} class="flex w-full items-center py-1.5 pr-2 pl-4 {className}">
  {@render leading?.()}
  <IconComponent size={24} class="shrink-0 {iconClass}" />
  <div class="ml-3.5 min-w-0 flex-1">
    <p class="truncate text-body-lg">{title}</p>
    {#if subtitle}
      <div class="flex items-center">
        <p class="min-w-0 flex-1 truncate text-body-sm text-on-surface-variant">{subtitle}</p>
        {@render subtitleTrailing?.()}
      </div>
    {/if}
  </div>
  {@render trailing?.()}
</Pressable>
