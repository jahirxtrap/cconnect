<script lang="ts">
  import { theme } from "$lib/design/theme.svelte";
  import { dismissPdfScreen, pdfScreenLayer, presentPdfScreen } from "$lib/platform/androidPdf";
  import { boundsOf, BrowserLayer, coverOf } from "$lib/screens/browser/browserLayer";
  import type { DeviceBounds } from "$lib/screens/browser/deviceBrowser.svelte";
  import { arrivesLater, serveFile, type ServedFile } from "$lib/services/mediaSource";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";

  interface Props {
    url: string;
    onerror: (missing: boolean) => void;
  }

  const { url, onerror }: Props = $props();

  const SEE_THROUGH = "pdf-screen";

  let surface = $state<HTMLDivElement | null>(null);
  let ready = $state(false);

  $effect(() => {
    const source = url;
    let cancelled = false;
    let served: ServedFile | null = null;
    ready = false;
    void serveFile(source)
      .then(async (file) => {
        served = file;
        if (cancelled) return;
        const shown = await presentPdfScreen(file.src, theme.current.colors.background);
        if (cancelled) return;
        if (shown) ready = true;
        else onerror(false);
      })
      .catch((error) => {
        if (!cancelled) onerror(arrivesLater(error));
      });
    return () => {
      cancelled = true;
      dismissPdfScreen();
      served?.close();
    };
  });

  $effect(() => {
    const node = surface;
    if (!node || !ready) return;
    const layer = new BrowserLayer(pdfScreenLayer);
    document.documentElement.classList.add(SEE_THROUGH);
    let dirty = true;
    let hole: DeviceBounds | null = null;
    const mark = () => (dirty = true);
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    window.addEventListener("resize", mark);
    let frame = requestAnimationFrame(function follow() {
      const next = boundsOf(node.getBoundingClientRect());
      if (dirty || JSON.stringify(next) !== JSON.stringify(hole)) {
        hole = next;
        dirty = false;
        layer.show(node, hole, hole ? coverOf(node, hole) : []);
      }
      frame = requestAnimationFrame(follow);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", mark);
      layer.clear();
      document.documentElement.classList.remove(SEE_THROUGH);
    };
  });
</script>

<div bind:this={surface} class="relative min-h-0 flex-1">
  {#if !ready}
    <CenteredProgress class="absolute inset-0" />
  {/if}
</div>
