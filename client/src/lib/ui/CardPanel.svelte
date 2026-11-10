<script lang="ts">
  import type { Snippet } from "svelte";
  import Pressable from "./Pressable.svelte";

  interface Props {
    onclick?: () => void;
    onlongclick?: () => void;
    oncontextmenu?: () => void;
    dense?: boolean;
    rows?: boolean;
    class?: string;
    children: Snippet;
  }

  const {
    onclick,
    onlongclick,
    oncontextmenu,
    dense = false,
    rows = false,
    class: className = "",
    children,
  }: Props = $props();
</script>

<Pressable
  {onclick}
  {onlongclick}
  {oncontextmenu}
  hover={false}
  class="flex w-full flex-col rounded-panel bg-card {dense ? 'px-3.5' : 'px-4'} {rows ? 'py-1.5' : 'py-3'} text-left {onclick || onlongclick || oncontextmenu
    ? 'ripple'
    : ''} {className}"
>
  {@render children()}
</Pressable>
