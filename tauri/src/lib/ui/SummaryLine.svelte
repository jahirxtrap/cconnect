<script lang="ts">
  import type { IconSource } from "./icons";

  interface Props {
    icon: IconSource;
    text: string;
    size?: number;
    fill?: boolean;
    class?: string;
  }

  const { icon: Icon, text, size = 10, fill = false, class: className = "" }: Props = $props();
</script>

<div class="flex items-center gap-1.5 {className}">
  <Icon {size} class="shrink-0 text-on-surface-variant {fill ? 'fill-current' : ''}" />
  <span class="min-w-0 flex-1 text-body-sm text-on-surface-variant">{text}</span>
</div>
