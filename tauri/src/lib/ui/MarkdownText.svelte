<script lang="ts">
  import { segments } from "$lib/markdown/render";
  import CodeBlock from "./CodeBlock.svelte";

  interface Props {
    text: string;
    class?: string;
  }

  const { text, class: className = "" }: Props = $props();

  const parts = $derived(segments(text));
</script>

<div class="markdown flex w-full flex-col gap-2 {className}">
  {#each parts as part, index (index)}
    {#if part.kind === "code"}
      <CodeBlock code={part.code} lang={part.lang} />
    {:else}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html part.html}
    {/if}
  {/each}
</div>
