<script lang="ts">
  import type { Snippet } from "svelte";
  import type { IconSource } from "./icons";

  interface Props {
    name: string;
    icon?: IconSource;
    onclick?: () => void;
    trailing?: Snippet;
  }

  const { name, icon: IconComponent, onclick, trailing }: Props = $props();

  const BASE_CLASS =
    "flex max-w-60 shrink-0 items-center gap-1.5 rounded-panel border-2 border-outline-variant px-2 py-1 select-none";
</script>

{#snippet body()}
  {#if IconComponent}
    <IconComponent size={14} class="shrink-0 text-accent" />
  {/if}
  <span class="min-w-0 flex-1 truncate text-left text-body-sm">{name}</span>
  {@render trailing?.()}
{/snippet}

{#if onclick}
  <button
    type="button"
    {onclick}
    class="{BASE_CLASS} cursor-pointer transition-colors hover:bg-on-surface/8"
  >
    {@render body()}
  </button>
{:else}
  <div class={BASE_CLASS}>
    {@render body()}
  </div>
{/if}
