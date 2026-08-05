<script lang="ts">
  import { t } from "$lib/i18n/index.svelte";
  import Button from "./Button.svelte";
  import CompactDialog from "./CompactDialog.svelte";

  interface Props {
    onScan: (raw: string) => void;
    onDismiss: () => void;
  }

  const { onScan, onDismiss }: Props = $props();

  const POLL_MS = 250;

  let video = $state<HTMLVideoElement | null>(null);
  let error = $state(false);

  $effect(() => {
    const element = video;
    if (!element) return;

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const start = async () => {
      const Detector = (window as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => unknown })
        .BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        error = true;
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      } catch {
        error = true;
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      element.srcObject = stream;
      await element.play().catch(() => undefined);

      const detector = new Detector({ formats: ["qr_code"] }) as {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
      timer = setInterval(async () => {
        const found = await detector.detect(element).catch(() => []);
        const raw = found[0]?.rawValue;
        if (raw) onScan(raw);
      }, POLL_MS);
    };

    void start();

    return () => {
      stopped = true;
      if (timer !== null) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  });
</script>

<CompactDialog title={t("SCAN_QR")} {onDismiss}>
  {#snippet buttons()}
    <Button onclick={onDismiss} variant="outlined">{t("CANCEL")}</Button>
  {/snippet}
  {#if error}
    <p class="text-body-md text-on-surface-variant">{t("SCAN_QR_UNAVAILABLE")}</p>
  {:else}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted class="aspect-square w-full rounded-panel bg-black object-cover"></video>
  {/if}
</CompactDialog>
