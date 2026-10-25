<script lang="ts">
  interface Props {
    colors: readonly string[];
  }

  const { colors }: Props = $props();
</script>

<span class="flex shrink-0 items-center gap-1">
  {#each colors as color, index (index)}
    <span class="size-3 rounded-full border border-outline-variant" style="background: {color}"></span>
  {/each}
</span>
