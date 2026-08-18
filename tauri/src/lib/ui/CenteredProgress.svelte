<script lang="ts">
  interface Props {
    size?: number;
    stroke?: number;
    class?: string;
  }

  const { size = 32, stroke = 4, class: className = "" }: Props = $props();
</script>

<div class="flex items-center justify-center overflow-hidden {className}">
  <span
    class="inline-block animate-spin rounded-full border-accent border-t-transparent"
    style="width: {size}px; height: {size}px; border-width: {stroke}px"
  ></span>
</div>
