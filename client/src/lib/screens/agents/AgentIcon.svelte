<script lang="ts">
  import BotMessageSquare from "@lucide/svelte/icons/bot-message-square";
  import { agents } from "$lib/services/agents.svelte";

  interface Props {
    url: string | null;
    size?: number;
    class?: string;
  }

  const { url, size, class: className = "" }: Props = $props();

  const src = $derived(url ? agents.iconSrc(url) : null);

  $effect(() => {
    if (url) agents.loadIcon(url);
  });
</script>

{#if src}
  <span
    style:mask-image={`url("${src}")`}
    style:width={size ? `${size}px` : undefined}
    style:height={size ? `${size}px` : undefined}
    class="inline-block shrink-0 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] {className}"
    aria-hidden="true"
  ></span>
{:else}
  <BotMessageSquare {size} class="shrink-0 {className}" />
{/if}
