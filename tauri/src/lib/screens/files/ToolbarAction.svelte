<script lang="ts">
  import type { IconSource } from "$lib/ui/icons";

  interface Props {
    icon: IconSource;
    label: string;
    onclick: () => void;
    enabled?: boolean;
  }

  const { icon: IconComponent, label, onclick, enabled = true }: Props = $props();
</script>

<button
  type="button"
  disabled={!enabled}
  {onclick}
  class="flex min-w-0 flex-1 cursor-pointer flex-col items-center rounded-md py-2 transition-colors hover:bg-on-surface/6 disabled:cursor-default disabled:opacity-40"
>
  <IconComponent size={22} />
  <span class="mt-0.5 max-w-full truncate px-1 text-label-md">{label}</span>
</button>
