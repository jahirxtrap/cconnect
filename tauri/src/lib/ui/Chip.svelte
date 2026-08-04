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
</script>

<div class="flex max-w-60 shrink-0 items-center gap-1.5 rounded-panel border border-outline-variant px-2 py-1">
  {#if IconComponent}
    <IconComponent size={14} class="shrink-0 text-accent" />
  {/if}
  {#if onclick}
    <button type="button" {onclick} class="min-w-0 flex-1 cursor-pointer truncate text-left text-body-sm">
      {name}
    </button>
  {:else}
    <span class="min-w-0 flex-1 truncate text-body-sm">{name}</span>
  {/if}
  {@render trailing?.()}
</div>
