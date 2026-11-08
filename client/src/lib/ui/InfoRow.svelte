<script lang="ts">
  import type { IconSource } from "./icons";

  interface Props {
    label: string;
    value: string;
    icon?: IconSource;
  }

  const { label, value, icon: IconComponent }: Props = $props();
</script>

<div class="flex items-center gap-3">
  {#if IconComponent}
    <IconComponent size={16} class="shrink-0 text-on-surface-variant" />
  {/if}
  <span class="shrink-0 text-body-sm text-on-surface-variant select-none">{label}</span>
  <span class="min-w-0 flex-1 truncate text-right text-body-sm">{value}</span>
</div>
