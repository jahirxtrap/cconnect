<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Clock3 from "@lucide/svelte/icons/clock-3";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { t } from "$lib/i18n/index.svelte";

  interface Props {
    kind: "slow" | "failed" | "compacting";
  }

  const { kind }: Props = $props();

  const failed = $derived(kind === "failed");
  const compacting = $derived(kind === "compacting");
  const tone = $derived(failed ? "red" : compacting ? "blue" : "orange");
  const label = $derived(failed ? t("STATUS_FAILED") : compacting ? t("COMPACTING") : t("STATUS_SLOW"));
</script>

<div class="w-full px-4 py-3 {tone === 'red' ? 'bg-red/15' : tone === 'blue' ? 'bg-blue/15' : 'bg-orange/15'}">
  <div class="flex items-center gap-2 {tone === 'red' ? 'text-red' : tone === 'blue' ? 'text-blue' : 'text-orange'}">
    {#if failed}
      <TriangleAlert size={18} class="shrink-0" />
    {:else if compacting}
      <Archive size={18} class="shrink-0" />
    {:else}
      <Clock3 size={18} class="shrink-0" />
    {/if}
    <span class="text-body-md">{label}</span>
  </div>
  {#if !failed}
    <div class="mt-2 h-1 w-full overflow-hidden rounded-full {tone === 'blue' ? 'bg-blue/30' : 'bg-orange/30'}">
      <span
        class="block h-full w-2/5 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full {tone === 'blue'
          ? 'bg-blue'
          : 'bg-orange'}"
      ></span>
    </div>
  {/if}
</div>
