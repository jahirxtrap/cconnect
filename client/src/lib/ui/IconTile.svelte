<script lang="ts">
  import type { IconSource } from "./icons";

  interface Props {
    icon: IconSource;
    class?: string;
  }

  const { icon: IconComponent, class: className = "" }: Props = $props();
</script>

<span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-on-surface-variant {className}">
  <IconComponent size={20} />
</span>
