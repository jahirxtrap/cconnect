<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    title: string;
    icon?: IconSource;
    subtitle?: string | null;
    iconClass?: string;
    dim?: boolean;
    onclick?: () => void;
    onlongclick?: () => void;
    oncontextmenu?: () => void;
    draggable?: boolean;
    ondragstart?: () => void;
    ondragend?: () => void;
    ondragover?: () => void;
    ondragleave?: () => void;
    ondrop?: () => void;
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
    dim = false,
    onclick,
    onlongclick,
    oncontextmenu,
    draggable = false,
    ondragstart,
    ondragend,
    ondragover,
    ondragleave,
    ondrop,
    class: className = "",
    leading,
    subtitleTrailing,
    trailing,
  }: Props = $props();
</script>

<div
  {draggable}
  ondragstart={ondragstart}
  ondragend={ondragend}
  ondragover={(event) => {
    if (!ondragover) return;
    event.preventDefault();
    ondragover();
  }}
  ondragleave={ondragleave}
  ondrop={(event) => {
    if (!ondrop) return;
    event.preventDefault();
    ondrop();
  }}
  role="presentation"
>
<Pressable
  {onclick}
  {onlongclick}
  {oncontextmenu}
  class="flex w-full items-center py-1.5 pr-2 pl-4 {dim ? 'opacity-50' : ''} {className}"
>
  {@render leading?.()}
  {#if IconComponent}
    <IconComponent size={24} class="shrink-0 {iconClass}" />
  {/if}
  <div class="min-w-0 flex-1 {IconComponent || leading ? 'ml-3.5' : ''}">
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
</div>
