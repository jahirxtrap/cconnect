<script lang="ts">
  import type { Snippet } from "svelte";
  import Pressable from "./Pressable.svelte";

  interface Props {
    onclick?: () => void;
    onlongclick?: () => void;
    oncontextmenu?: () => void;
    class?: string;
    children: Snippet;
  }

  const { onclick, onlongclick, oncontextmenu, class: className = "", children }: Props = $props();
</script>

<Pressable
  {onclick}
  {onlongclick}
  {oncontextmenu}
  hover={false}
  class="flex w-full flex-col rounded-panel bg-card px-3.5 py-3 text-left {onclick || onlongclick || oncontextmenu
    ? 'ripple'
    : ''} {className}"
>
  {@render children()}
</Pressable>
