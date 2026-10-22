<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";

  interface Props {
    src: string;
  }

  const { src }: Props = $props();

  let failed = $state("");
</script>

{#if src && failed !== src}
  <img {src} alt="" draggable="false" class="size-4 shrink-0 object-contain" onerror={() => (failed = src)} />
{:else}
  <Globe size={16} class="shrink-0" />
{/if}
