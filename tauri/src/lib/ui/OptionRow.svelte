<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  interface Props {
    label: string;
    onclick: () => void;
    description?: string | null;
    selected?: boolean;
    multi?: boolean;
  }

  const { label, onclick, description = null, selected = false, multi = false }: Props = $props();
</script>

<button
  type="button"
  {onclick}
  class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-on-surface/8"
>
  <span
    class="flex size-5 shrink-0 items-center justify-center border-2 transition-colors {multi
      ? 'rounded-sm'
      : 'rounded-full'} {selected ? 'border-accent' : 'border-outline'}"
  >
    {#if selected}
      {#if multi}
        <Check size={13} class="text-accent" />
      {:else}
        <span class="size-2.5 rounded-full bg-accent"></span>
      {/if}
    {/if}
  </span>
  <span class="min-w-0 flex-1">
    <span class="block text-body-md {selected ? 'text-accent' : ''}">{label}</span>
    {#if description?.trim()}
      <span class="block text-body-sm text-on-surface-variant">{description}</span>
    {/if}
  </span>
</button>
