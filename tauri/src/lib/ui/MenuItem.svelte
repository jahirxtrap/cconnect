<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import type { Snippet } from "svelte";
  import Pressable from "./Pressable.svelte";

  interface Props {
    text: string;
    onclick?: () => void;
    selected?: boolean;
    enabled?: boolean;
    textClass?: string;
    leading?: Snippet;
    trailing?: Snippet;
  }

  const {
    text,
    onclick,
    selected = false,
    enabled = true,
    textClass = "",
    leading,
    trailing,
  }: Props = $props();
</script>

<Pressable {onclick} {enabled} class="flex w-full items-center px-3.5 py-1.5 {enabled ? '' : 'opacity-40'}">
  {#if leading}
    <div class="mr-2.5 shrink-0">{@render leading()}</div>
  {/if}
  <span class="min-w-0 flex-1 truncate text-body-md {textClass}">{text}</span>
  {#if selected}
    <Check size={20} class="ml-2.5 shrink-0 text-accent" />
  {/if}
  {#if trailing}
    <div class="ml-2.5 shrink-0">{@render trailing()}</div>
  {/if}
</Pressable>
