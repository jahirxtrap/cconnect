<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import { maskSrc } from "$lib/services/mediaSource";

  interface Props {
    url: string | null;
    size?: number;
    class?: string;
  }

  const { url, size = 16, class: className = "" }: Props = $props();

  let failed = $state<string | null>(null);
  let loaded = $state<string | null>(null);
</script>

{#if url && failed !== url}
  <span
    use:maskSrc={{ url, onload: () => (loaded = url), onerror: () => (failed = url) }}
    style="width: {size}px; height: {size}px"
    class="inline-block shrink-0 [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] {loaded === url
      ? 'bg-current'
      : ''} {className}"
    aria-hidden="true"
  ></span>
{:else}
  <Bot {size} class="shrink-0 {className}" />
{/if}
