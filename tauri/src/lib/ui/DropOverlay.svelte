<script lang="ts">
  interface Props {
    visible: boolean;
  }

  const { visible }: Props = $props();
</script>

{#if visible}
  <div class="drop-overlay pointer-events-none absolute inset-1 z-30 rounded-lg border-2 border-accent/85 bg-accent/12"></div>
{/if}
