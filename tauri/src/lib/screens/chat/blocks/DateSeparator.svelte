<script lang="ts">
  import Calendar from "@lucide/svelte/icons/calendar";
  import { formatDay } from "$lib/data/time";

  interface Props {
    millis: number;
  }

  const { millis }: Props = $props();
</script>

<div class="flex w-full items-center justify-center gap-1.5 px-4 select-none">
  <Calendar size={16} class="shrink-0 text-on-surface-variant" />
  <span class="text-label-lg text-on-surface-variant">{formatDay(millis)}</span>
</div>
