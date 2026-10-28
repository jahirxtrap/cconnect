<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import { maskSrc } from "$lib/services/mediaSource";

  interface Props {
    url: string | null;
    size?: number;
    class?: string;
  }

  const { url, size, class: className = "" }: Props = $props();

  let failed = $state<string | null>(null);
  let loaded = $state<string | null>(null);

  const drawn = $derived(!!url && loaded === url && failed !== url);
</script>

{#if url && failed !== url}
  <span
    use:maskSrc={{ url, onload: () => (loaded = url), onerror: () => (failed = url) }}
    style={size ? `width: ${size}px; height: ${size}px` : undefined}
    class="{drawn
      ? 'inline-block bg-current'
      : 'hidden'} shrink-0 [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] {className}"
    aria-hidden="true"
  ></span>
{/if}
{#if !drawn}
  <Bot {size} class="shrink-0 {className}" />
{/if}
