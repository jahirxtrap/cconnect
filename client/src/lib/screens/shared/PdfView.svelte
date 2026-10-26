<script lang="ts">
  import type { PDFDocumentLoadingTask } from "pdfjs-dist";
  import type { PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
  import "pdfjs-dist/web/pdf_viewer.css";
  import { openExternal } from "$lib/platform";
  import { fetchFile } from "$lib/services/mediaSource";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";

  interface Props {
    url: string;
    onerror: () => void;
  }

  interface Engine {
    pdfjs: typeof import("pdfjs-dist");
    view: PDFViewer;
    links: PDFLinkService;
  }

  const { url, onerror }: Props = $props();

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const DOUBLE_TAP_ZOOM = 2.5;
  const WHEEL_STEP = 0.0015;
  const DRAWING_DELAY = 250;
  const SHARPEN_INTERVAL = 150;
  const SCALE_STEPS = 100;
  const MAX_ROUND_UNIT = 8;
  const ALIGN_SLACK = 0.01;
  const HALF = 2;
  const EXTERNAL_LINK = /^(https?|mailto):/i;

  let container = $state<HTMLDivElement | null>(null);
  let pages = $state<HTMLDivElement | null>(null);
  let loading = $state(true);
  let zoom = $state(MIN_ZOOM);
  let engine = $state.raw<Engine | null>(null);

  const zoomed = $derived(zoom > MIN_ZOOM);

  let pageWidth = 0;
  let onscreen = false;
  let sharpened = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const points = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchZoom = 1;

  const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const roundUnit = () => {
    const drawn = parseFloat(pages?.querySelector<HTMLElement>(".page")?.style.getPropertyValue("--scale-round-x") ?? "");
    if (drawn > 0) return drawn;
    const ratio = window.devicePixelRatio || 1;
    for (let unit = 1; unit <= MAX_ROUND_UNIT; unit++) {
      if (Math.abs(ratio * unit - Math.round(ratio * unit)) < 1 / SCALE_STEPS) return unit;
    }
    return 1;
  };

  const target = () => {
    if (!container || !pageWidth) return null;
    const unit = roundUnit();
    return ((Math.ceil(container.clientWidth / unit) * unit + ALIGN_SLACK) / pageWidth) * zoom;
  };

  const center = () => {
    const box = container;
    if (box && !zoomed) box.scrollLeft = (box.scrollWidth - box.clientWidth) / HALF;
  };

  const scaleTo = (scale: number, origin?: [number, number]) => {
    const view = engine?.view;
    if (!view || Math.abs(scale - view.currentScale) < 1 / SCALE_STEPS) return;
    view.updateScale({ scaleFactor: scale / view.currentScale, drawingDelay: DRAWING_DELAY, origin });
    center();
  };

  const apply = (view: PDFViewer, scale: number) => {
    view.currentScale = scale;
    center();
  };

  const settle = () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      const view = engine?.view;
      const scale = target();
      if (view && scale !== null) apply(view, scale);
    }, DRAWING_DELAY);
  };

  const refit = () => {
    const view = engine?.view;
    const scale = target();
    if (!view || loading || scale === null) return;
    const now = performance.now();
    if (onscreen && now - sharpened >= SHARPEN_INTERVAL) {
      sharpened = now;
      apply(view, scale);
    } else {
      scaleTo(scale);
    }
    settle();
  };

  const zoomAt = (next: number, clientX: number, clientY: number) => {
    const box = container;
    if (!box) return;
    zoom = clamp(next);
    const scale = target();
    if (scale === null) return;
    const rect = box.getBoundingClientRect();
    scaleTo(scale, [clientX - rect.left, clientY - rect.top]);
    settle();
  };

  const spread = () => {
    const [first, second] = [...points.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  };

  const centre = () => {
    const [first, second] = [...points.values()];
    return { x: (first.x + second.x) / HALF, y: (first.y + second.y) / HALF };
  };

  const regrip = () => {
    pinchDistance = points.size >= 2 ? spread() : 0;
    pinchZoom = zoom;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.isPrimary) points.clear();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    regrip();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size < 2 || pinchDistance <= 0) return;
    event.preventDefault();
    const focus = centre();
    zoomAt((pinchZoom * spread()) / pinchDistance, focus.x, focus.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    points.delete(event.pointerId);
    regrip();
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    zoomAt(zoom - event.deltaY * WHEEL_STEP * zoom, event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    zoomAt(zoomed ? MIN_ZOOM : DOUBLE_TAP_ZOOM, event.clientX, event.clientY);
  };

  const onClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(".annotationLayer a[href]");
    if (!link || !EXTERNAL_LINK.test(link.href)) return;
    event.preventDefault();
    openExternal(link.href);
  };

  $effect(() => {
    const box = container;
    const host = pages;
    if (!box || !host) return;
    let cancelled = false;

    const start = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
      const { EventBus, LinkTarget, PDFLinkService, PDFViewer } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      if (cancelled) return;
      const eventBus = new EventBus();
      const links = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK });
      const view = new PDFViewer({
        container: box,
        viewer: host,
        eventBus,
        linkService: links,
        removePageBorders: true,
        annotationMode: pdfjs.AnnotationMode.ENABLE,
      });
      links.setViewer(view);
      eventBus.on("pagesinit", () => {
        const first = view.getPageView(0);
        pageWidth = first ? first.width / view.currentScale : 0;
        zoom = MIN_ZOOM;
        const scale = target();
        if (scale !== null) apply(view, scale);
        loading = false;
      });
      eventBus.on("pagerendered", () => {
        const scale = target();
        if (scale !== null && Math.abs(scale - view.currentScale) > 1 / SCALE_STEPS / SCALE_STEPS) apply(view, scale);
        else center();
      });
      engine = { pdfjs, view, links };
    };

    start().catch(() => {
      if (!cancelled) onerror();
    });
    const observer = new ResizeObserver(refit);
    observer.observe(box);
    const visibility = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
    });
    visibility.observe(box);

    return () => {
      cancelled = true;
      observer.disconnect();
      visibility.disconnect();
      if (settleTimer !== null) clearTimeout(settleTimer);
      engine = null;
    };
  });

  $effect(() => {
    const current = engine;
    const source = url;
    if (!current) return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    loading = true;

    const open = async () => {
      const response = await fetchFile(source);
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.arrayBuffer();
      if (cancelled) return;
      task = current.pdfjs.getDocument({ data });
      const document_ = await task.promise;
      if (cancelled) return;
      current.view.setDocument(document_);
      current.links.setDocument(document_);
    };

    open().catch(() => {
      if (!cancelled) onerror();
    });

    return () => {
      cancelled = true;
      void task?.destroy();
    };
  });
</script>

<div class="relative min-h-0 flex-1">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    bind:this={container}
    class="scrollbar-thin absolute inset-0 touch-pan-x touch-pan-y overscroll-contain {zoomed
      ? 'overflow-auto'
      : 'overflow-x-hidden overflow-y-auto'}"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onwheel={onWheel}
    ondblclick={onDoubleClick}
    onclick={onClick}
  >
    <div bind:this={pages} class="pdfViewer"></div>
  </div>
  {#if loading}
    <CenteredProgress class="absolute inset-0" />
  {/if}
</div>
