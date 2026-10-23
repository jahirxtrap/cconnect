<script lang="ts">
  import LoadingIndicator from "./LoadingIndicator.svelte";

  interface Props {
    class?: string;
    box?: number;
    color?: string | null;
    ring?: boolean;
    loading?: boolean;
    spinnerClass?: string;
  }

  const {
    class: className = "bg-gray",
    box = 8,
    color = null,
    ring = false,
    loading = false,
    spinnerClass,
  }: Props = $props();

  const MARK = 8;
</script>

<span
  class="inline-flex shrink-0 items-center justify-center"
  style="width: {box}px; height: {box}px"
>
  {#if loading}
    <LoadingIndicator size={MARK} fill class={spinnerClass} />
  {:else}
    <span
      class="size-(--dot-size) rounded-full {ring ? 'dot-ring' : ''} {color ? '' : className}"
      style={color ? `background: ${color}` : undefined}
    ></span>
  {/if}
</span>
