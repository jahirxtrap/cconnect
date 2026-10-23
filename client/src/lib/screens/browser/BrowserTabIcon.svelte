<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";

  interface Props {
    src: string;
    large?: boolean;
  }

  const { src, large = false }: Props = $props();

  const SMALL_SIZE = 12;
  const LARGE_SIZE = 20;

  let failed = $state("");
</script>

{#if src && failed !== src}
  <img
    {src}
    alt=""
    draggable="false"
    class="{large ? 'size-5' : 'size-3'} shrink-0 object-contain"
    onerror={() => (failed = src)}
  />
{:else}
  <Globe size={large ? LARGE_SIZE : SMALL_SIZE} class="shrink-0" />
{/if}
