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

<header class="flex h-12 shrink-0 items-center gap-1 bg-background px-1 {className}">
  {@render navigationIcon?.()}
  <div class="ml-3 min-w-0 flex-1">
    <p class="truncate text-title-lg">{title}</p>
    {#if subtitle}
      <div class="flex items-center gap-1">
        {@render subtitleLeading?.()}
        <p class="truncate text-label-md text-on-surface-variant">{subtitle}</p>
      </div>
    {/if}
  </div>
  {@render actions?.()}
</header>
