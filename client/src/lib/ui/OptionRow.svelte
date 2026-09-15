<script lang="ts">
  import SelectionDot from "./SelectionDot.svelte";

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
  <SelectionDot {selected} {multi} />
  <span class="min-w-0 flex-1">
    <span class="block text-body-md {selected ? 'text-accent' : ''}">{label}</span>
    {#if description?.trim()}
      <span class="block text-body-sm text-on-surface-variant">{description}</span>
    {/if}
  </span>
</button>
