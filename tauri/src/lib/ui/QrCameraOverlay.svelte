<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { t } from "$lib/i18n/index.svelte";
  import { cameraScan, cancelCameraScan } from "$lib/services/qrScanner.svelte";
  import AppTopBar from "./AppTopBar.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";
</script>

{#if cameraScan.active}
  <div class="qr-overlay safe-area fixed inset-0 z-80 flex flex-col">
    <AppTopBar title={t("SCAN_QR")}>
      {#snippet navigationIcon()}
        <TooltipIconButton label={t("BACK")} onclick={() => void cancelCameraScan()}>
          <ArrowLeft size={20} />
        </TooltipIconButton>
      {/snippet}
    </AppTopBar>
  </div>
{/if}
