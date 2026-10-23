<script lang="ts">
  import { Portal } from "bits-ui";
  import type { Snippet } from "svelte";
  import { layout } from "$lib/platform/layout.svelte";
  import { TOOLTIP_CLASS } from "./menuSurface";

  interface Props {
    text?: string;
    anchor: { x: number; top: number; bottom: number } | null;
    within?: HTMLElement | null;
    onDismiss?: (() => void) | null;
    children?: Snippet;
  }

  const { text = "", anchor, within = null, onDismiss = null, children = undefined }: Props = $props();

  let keyboardWhenShown: number | null = null;

  $effect(() => {
    const keyboard = layout.keyboard;
    if (anchor === null) {
      keyboardWhenShown = null;
      return;
    }
    if (keyboardWhenShown === null) {
      keyboardWhenShown = keyboard;
      return;
    }
    if (keyboard !== keyboardWhenShown) onDismiss?.();
  });

  $effect(() => {
    if (anchor === null || !onDismiss) return;
    const close = (event?: Event) => {
      const target = event?.target;
      if (within && target instanceof Node && within.contains(target)) return;
      onDismiss();
    };
    const view = window.visualViewport;
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("touchmove", close, true);
    window.addEventListener("wheel", close, true);
    window.addEventListener("keydown", close, true);
    view?.addEventListener("resize", close);
    view?.addEventListener("scroll", close);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("touchmove", close, true);
      window.removeEventListener("wheel", close, true);
      window.removeEventListener("keydown", close, true);
      view?.removeEventListener("resize", close);
      view?.removeEventListener("scroll", close);
    };
  });

  const GAP = 4;
  const EDGE = 8;
  const HALF = 2;

  let width = $state(0);
  let height = $state(0);

  const minLeft = $derived(layout.safeLeft + EDGE);
  const maxLeft = $derived(Math.max(minLeft, window.innerWidth - layout.safeRight - width - EDGE));
  const left = $derived(anchor === null ? 0 : Math.min(Math.max(anchor.x - width / HALF, minLeft), maxLeft));

  const above = $derived(anchor !== null && anchor.top - GAP - height >= layout.safeTop + EDGE);
  const top = $derived(
    anchor === null ? 0 : above ? anchor.top - GAP - height : anchor.bottom + GAP,
  );
</script>

{#if anchor}
  <Portal>
    <div
      bind:clientWidth={width}
      bind:clientHeight={height}
      style="left: {left}px; top: {top}px"
      class="pointer-events-none fixed z-75 whitespace-nowrap {TOOLTIP_CLASS}"
    >
      {#if children}{@render children()}{:else}{text}{/if}
    </div>
  </Portal>
{/if}
