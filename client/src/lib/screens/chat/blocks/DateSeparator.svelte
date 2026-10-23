<script lang="ts">
  import { formatDay } from "$lib/data/time";

  interface Props {
    millis: number;
  }

  const { millis }: Props = $props();
</script>

<div class="flex w-full justify-center px-(--page-inset) py-(--chat-gap-sm) select-none">
  <span class="flex h-6 items-center rounded-full bg-surface-variant px-3 text-label-sm text-on-surface-variant">
    {formatDay(millis)}
  </span>
</div>
