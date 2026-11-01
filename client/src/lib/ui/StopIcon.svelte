<script lang="ts">
  import Square from "@lucide/svelte/icons/square";

  interface Props {
    size?: number;
    class?: string;
  }

  const { size = 24, class: className = "" }: Props = $props();
</script>

<Square {size} fill="currentColor" class={className} />
