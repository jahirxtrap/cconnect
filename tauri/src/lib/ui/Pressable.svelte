<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    onclick?: () => void;
    onlongclick?: () => void;
    enabled?: boolean;
    title?: string;
    class?: string;
    children: Snippet;
  }

  const {
    onclick,
    onlongclick,
    enabled = true,
    title,
    class: className = "",
    children,
  }: Props = $props();

  const LONG_PRESS_MS = 500;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let fired = $state(false);

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const start = () => {
    if (!onlongclick || !enabled) return;
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      onlongclick();
    }, LONG_PRESS_MS);
  };

  const activate = () => {
    cancel();
    if (fired) {
      fired = false;
      return;
    }
    onclick?.();
  };
</script>

{#if onclick || onlongclick}
  <button
    type="button"
    disabled={!enabled}
    {title}
    onclick={activate}
    onpointerdown={start}
    onpointerup={cancel}
    onpointerleave={cancel}
    oncontextmenu={onlongclick ? (event) => event.preventDefault() : undefined}
    class="cursor-pointer text-left transition-colors enabled:hover:bg-on-surface/8 disabled:cursor-default {className}"
  >
    {@render children()}
  </button>
{:else}
  <div {title} class={className}>{@render children()}</div>
{/if}
