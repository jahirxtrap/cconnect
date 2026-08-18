<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }

  const { size = 24, class: className = "" }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" class={className}>
  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
</svg>
