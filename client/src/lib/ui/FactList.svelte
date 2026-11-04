<script lang="ts">
  interface Props {
    rows: { label: string; text: string | null }[];
  }

  const { rows }: Props = $props();
</script>

{#if rows.length}
  <dl class="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 text-body-sm">
    {#each rows as fact (fact.label)}
      <dt class="text-faint">{fact.label}</dt>
      <dd class="wrap-anywhere">{fact.text}</dd>
    {/each}
  </dl>
{/if}
