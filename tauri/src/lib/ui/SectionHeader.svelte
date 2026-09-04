<script lang="ts">
  interface Props {
    label: string;
    divider?: boolean;
  }

  const { label, divider = false }: Props = $props();
</script>

{#if divider}
  <div class="mx-2 my-1 h-px bg-outline-variant"></div>
{/if}
<p
  class="flex h-7 items-center truncate px-2 text-label-md tracking-[0.6px] text-on-surface-variant uppercase"
>
  {label}
</p>
