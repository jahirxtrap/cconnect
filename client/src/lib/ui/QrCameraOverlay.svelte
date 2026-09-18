<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import { pushDismiss } from "$lib/app/dismissStack";
  import { t } from "$lib/i18n/index.svelte";
  import { cameraScan, cancelCameraScan, finishBrowserScan } from "$lib/services/qrScanner.svelte";
  import AppTopBar from "./AppTopBar.svelte";
  import TooltipIconButton from "./TooltipIconButton.svelte";

  const SCANS_PER_SECOND = 5;

  let preview = $state<HTMLVideoElement | null>(null);

  $effect(() => {
    if (!cameraScan.active) return;
    return pushDismiss(() => void cancelCameraScan());
  });

  $effect(() => {
    const video = preview;
    if (!cameraScan.browser || !video) return;
    let scanner: { start: () => Promise<void>; stop: () => void; destroy: () => void } | null = null;
    let dropped = false;
    void (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (dropped) return;
      scanner = new QrScanner(video, (result) => finishBrowserScan(result.data), {
        preferredCamera: "environment",
        maxScansPerSecond: SCANS_PER_SECOND,
        highlightScanRegion: false,
        returnDetailedScanResult: true,
      });
      await scanner.start().catch(() => finishBrowserScan(null));
    })();
    return () => {
      dropped = true;
      scanner?.stop();
      scanner?.destroy();
    };
  });
</script>

{#if cameraScan.active}
  <div
    class="qr-overlay safe-area above-keyboard fixed inset-0 z-80 flex flex-col {cameraScan.browser
      ? 'bg-black'
      : ''}"
  >
    {#if cameraScan.browser}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={preview} playsinline muted class="absolute inset-0 size-full object-cover"></video>
    {/if}
    <div class="relative">
      <AppTopBar title={t("SCAN_QR")}>
        {#snippet navigationIcon()}
          <TooltipIconButton label={t("BACK")} onclick={() => void cancelCameraScan()}>
            <ArrowLeft size={20} />
          </TooltipIconButton>
        {/snippet}
      </AppTopBar>
    </div>
  </div>
{/if}
