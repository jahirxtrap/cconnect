<script module lang="ts">
  export const TAB_PAGE_CLASS = "flex w-full shrink-0 snap-center flex-col";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { animateScrollLeft } from "./animateScroll";

  interface Props {
    selected: number;
    onSelect: (index: number) => void;
    class?: string;
    children: Snippet;
  }

  const { selected, onSelect, class: className = "", children }: Props = $props();

  let pager = $state<HTMLDivElement | null>(null);
  let shown = 0;
  let placed: HTMLDivElement | null = null;
  let settling = false;

  $effect(() => {
    const index = selected;
    const node = pager;
    if (!node) return;
    const far = placed !== node || Math.abs(index - shown) > 1;
    if (placed === node && index === shown) return;
    placed = node;
    shown = index;
    const target = index * node.clientWidth;
    if (far) {
      node.scrollLeft = target;
      return;
    }
    settling = true;
    void animateScrollLeft(node, target).then((last) => {
      if (last) settling = false;
    });
  });

  const onScroll = () => {
    if (!pager || settling) return;
    shown = Math.round(pager.scrollLeft / pager.clientWidth);
    onSelect(shown);
  };
</script>

<div
  bind:this={pager}
  onscroll={onScroll}
  class="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain {className}"
>
  {@render children()}
</div>
