<script lang="ts">
  interface Props {
    label: string;
    selected?: boolean;
    required?: boolean;
    count?: number | null;
    onclick?: (() => void) | null;
  }

  const { label, selected = false, required = false, count = null, onclick = null }: Props = $props();

  const BASE_CLASS =
    "inline-flex h-7 max-w-60 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-body-sm whitespace-nowrap transition-colors select-none";
  const TONE = $derived(
    selected ? "bg-accent-soft text-on-surface" : "bg-surface-variant text-on-surface-variant",
  );
</script>

{#snippet body()}
  <span class="truncate">{label}{#if required}&nbsp;*{/if}</span>
  {#if count !== null}
    <span class="text-caption text-accent">{count}</span>
  {/if}
{/snippet}

{#if onclick}
  <button type="button" {onclick} class="{BASE_CLASS} {TONE} cursor-pointer {selected ? '' : 'ripple hover:text-on-surface'}">
    {@render body()}
  </button>
{:else}
  <span class="{BASE_CLASS} {TONE}">
    {@render body()}
  </span>
{/if}
