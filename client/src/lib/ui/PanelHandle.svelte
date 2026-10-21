<script lang="ts">
  interface Props {
    active?: boolean;
  }

  const { active = false }: Props = $props();
</script>

<span class="h-1 w-8 rounded-[2px] transition-colors {active ? 'bg-accent' : 'bg-on-surface-variant/40'}"></span>
