<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    class?: string;
    // Shares the axis with a centred, width-capped page below it.
    contained?: boolean;
    navigationIcon?: Snippet;
    subtitleLeading?: Snippet;
    actions?: Snippet;
  }

  const {
    title,
    subtitle,
    class: className = "",
    contained = false,
    navigationIcon,
    subtitleLeading,
    actions,
  }: Props = $props();
</script>

<header class="flex h-14 shrink-0 items-center border-b border-outline-variant bg-background px-1 {className}">
  <div class="flex min-w-0 flex-1 items-center {contained ? 'mx-auto max-w-3xl px-3' : ''}">
    {@render navigationIcon?.()}
    <div class="min-w-0 flex-1 {navigationIcon ? 'ml-0.5' : 'ml-3'}">
      <p class="truncate text-topbar-title">{title}</p>
      {#if subtitle}
        <div class="flex items-center gap-1">
          {@render subtitleLeading?.()}
          <p class="truncate text-topbar-subtitle text-on-surface-variant">{subtitle}</p>
        </div>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
    {/if}
  </div>
</header>
