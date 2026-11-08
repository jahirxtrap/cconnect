<script lang="ts">
  interface Props {
    label: string;
    value: string;
  }

  const { label, value }: Props = $props();
</script>

<div class="flex items-center gap-3">
  <span class="shrink-0 text-body-sm text-on-surface-variant select-none">{label}</span>
  <span class="min-w-0 flex-1 truncate text-right text-body-sm">{value}</span>
</div>
