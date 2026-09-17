<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";
  import Pressable from "./Pressable.svelte";

  interface Props {
    title: string;
    icon?: IconSource;
    iconBadge?: IconSource | null;
    badgeClass?: string;
    subtitle?: string | null;
    iconClass?: string;
    dim?: boolean;
    padding?: string;
    subtitleLines?: number;
    onclick?: () => void;
    onlongclick?: () => void;
    oncontextmenu?: () => void;
    class?: string;
    leading?: Snippet;
    subtitleTrailing?: Snippet;
    trailing?: Snippet;
  }

  const {
    icon: IconComponent,
    iconBadge: BadgeComponent = null,
    badgeClass = "text-on-surface-variant",
    title,
    subtitle,
    iconClass = "text-accent",
    dim = false,
    padding = "py-1.5 pr-2 pl-4",
    subtitleLines = 1,
    onclick,
    onlongclick,
    oncontextmenu,
    class: className = "",
    leading,
    subtitleTrailing,
    trailing,
  }: Props = $props();
</script>

<Pressable
  {onclick}
  {onlongclick}
  {oncontextmenu}
  class="flex w-full items-center {padding} {dim ? 'opacity-50' : ''} {className}"
>
  {@render leading?.()}
  {#if IconComponent}
    <span class="relative shrink-0">
      <IconComponent size={24} class={iconClass} />
      {#if BadgeComponent}
        <span class="absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full bg-background {badgeClass}">
          <BadgeComponent size={12} />
        </span>
      {/if}
    </span>
  {/if}
  <div class="min-w-0 flex-1 {IconComponent || leading ? 'ml-3.5' : ''}">
    <p class="truncate text-body-lg">{title}</p>
    {#if subtitle}
      <div class="flex items-center">
        <p
          class="min-w-0 flex-1 text-body-sm text-on-surface-variant {subtitleLines > 1
            ? 'line-clamp-2'
            : 'truncate'}"
        >
          {subtitle}
        </p>
        {@render subtitleTrailing?.()}
      </div>
    {/if}
  </div>
  {#if trailing}
    <div class="flex shrink-0 items-center">{@render trailing()}</div>
  {/if}
</Pressable>
