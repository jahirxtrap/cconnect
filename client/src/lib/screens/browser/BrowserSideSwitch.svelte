<script lang="ts">
  import MonitorSmartphone from "@lucide/svelte/icons/monitor-smartphone";
  import Server from "@lucide/svelte/icons/server";
  import { t } from "$lib/i18n/index.svelte";
  import TooltipIconButton from "$lib/ui/TooltipIconButton.svelte";
  import type { BrowserSide } from "./browserTabs";

  interface Props {
    side: BrowserSide;
    onSelect: (side: BrowserSide) => void;
  }

  const { side, onSelect }: Props = $props();

  const onServer = $derived(side === "server");
</script>

<TooltipIconButton
  label={t(onServer ? "BROWSER_SIDE_SERVER" : "BROWSER_SIDE_DEVICE")}
  class="size-7"
  onclick={() => onSelect(onServer ? "device" : "server")}
>
  {#if onServer}
    <Server />
  {:else}
    <MonitorSmartphone />
  {/if}
</TooltipIconButton>
