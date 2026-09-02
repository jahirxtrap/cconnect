<script lang="ts">
  import MarkdownText from "$lib/ui/MarkdownText.svelte";
  import { scratch } from "./scratch.svelte";
</script>

{#if scratch.formatted}
  <div class="selectable min-h-0 flex-1 overflow-y-auto p-4">
    <MarkdownText text={scratch.text} />
  </div>
{:else}
  <textarea
    value={scratch.text}
    oninput={(event) => scratch.write(event.currentTarget.value)}
    spellcheck="false"
    class="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-body-md caret-accent outline-none"
  ></textarea>
{/if}
