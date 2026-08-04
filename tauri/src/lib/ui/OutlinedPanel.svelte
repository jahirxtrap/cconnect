<script lang="ts">
  import type { Snippet } from "svelte";
  import Pressable from "./Pressable.svelte";

  interface Props {
    onclick?: () => void;
    class?: string;
    children: Snippet;
  }

  const { onclick, class: className = "", children }: Props = $props();
</script>

<Pressable {onclick} class="flex flex-col rounded-panel border border-outline-variant px-3.5 py-2.5 {className}">
  {@render children()}
</Pressable>
