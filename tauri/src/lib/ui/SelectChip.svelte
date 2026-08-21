<script lang="ts">
  interface Props {
    label: string;
    selected?: boolean;
    onclick?: (() => void) | null;
  }

  const { label, selected = false, onclick = null }: Props = $props();

  const BASE_CLASS = "max-w-60 shrink-0 truncate rounded-md px-2.5 py-1 text-label-md transition-colors select-none";
  const TONE = $derived(selected ? "bg-accent/18 text-accent" : "bg-surface-variant text-on-surface-variant");
</script>

{#if onclick}
  <button type="button" {onclick} class="{BASE_CLASS} {TONE} cursor-pointer">
    {label}
  </button>
{:else}
  <span class="{BASE_CLASS} {TONE} inline-block">
    {label}
  </span>
{/if}
