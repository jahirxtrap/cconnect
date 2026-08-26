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

<Pressable
  {onclick}
  class="flex w-full flex-col rounded-panel border-2 border-outline-variant px-3.5 py-2.5 text-left {className}"
>
  {@render children()}
</Pressable>
