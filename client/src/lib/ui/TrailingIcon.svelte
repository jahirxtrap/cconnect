<script lang="ts">
  import type { IconSource } from "./icons";
  import { PREFERENCE_ICON_SIZE } from "./preferenceRow";

  interface Props {
    icon: IconSource;
  }

  const { icon: IconComponent }: Props = $props();
</script>

<span class="inline-flex size-8 shrink-0 items-center justify-center text-on-surface-variant">
  <IconComponent size={PREFERENCE_ICON_SIZE} />
</span>
