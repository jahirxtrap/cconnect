<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    subtitle?: string | null;
    class?: string;
    navigationIcon?: Snippet;
    subtitleLeading?: Snippet;
    actions?: Snippet;
  }

  const { title, subtitle, class: className = "", navigationIcon, subtitleLeading, actions }: Props = $props();
</script>

<header class="flex h-14 shrink-0 items-center bg-background px-1 {className}">
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
  {@render actions?.()}
</header>
