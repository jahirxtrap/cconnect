<script lang="ts">
  import type { Snippet } from "svelte";
  import { BAR_CARD_CLASS, BAR_LABEL_CLASS } from "$lib/ui/actionBar";

  interface Props {
    label: string;
    children?: Snippet;
  }

  const { label, children }: Props = $props();
</script>

<div class={BAR_CARD_CLASS}>
  <span class={BAR_LABEL_CLASS}>{label}</span>
  {@render children?.()}
</div>
