<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  interface Props {
    done: boolean;
    active?: boolean;
  }

  const { done, active = false }: Props = $props();

  const STROKE = 1.5;
  const CHECK = 12;
</script>

<span
  style="border-width: {STROKE}px"
  class="flex size-4 shrink-0 items-center justify-center rounded-xs {done
    ? 'border-accent bg-accent text-on-accent'
    : active
      ? 'border-accent'
      : 'border-outline'}"
>
  {#if done}
    <Check size={CHECK} class="[stroke-width:2.6]" />
  {:else if active}
    <span class="size-1.5 rounded-xs bg-accent"></span>
  {/if}
</span>
