<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import SegmentedButtons from "$lib/ui/SegmentedButtons.svelte";
  import { monitor } from "./monitor.svelte";

  interface Props {
    fill?: boolean;
  }

  const { fill = false }: Props = $props();
</script>

{#if monitor.info}
  <SegmentedButtons
    options={monitor.pages.map((key) => t(key))}
    selected={monitor.page}
    onSelect={(index) => (monitor.page = index)}
    {fill}
  />
{/if}
