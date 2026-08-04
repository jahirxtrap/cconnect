<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }

  const { size = 32, class: className = "" }: Props = $props();
</script>

<div class="flex items-center justify-center {className}">
  <span
    class="inline-block animate-spin rounded-full border-4 border-accent border-t-transparent"
    style="width: {size}px; height: {size}px"
  ></span>
</div>
