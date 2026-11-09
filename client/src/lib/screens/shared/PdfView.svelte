<script lang="ts">
  import type { PDFDocumentLoadingTask } from "pdfjs-dist";
  import type { EventBus, PDFLinkService, PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
  import "pdfjs-dist/web/pdf_viewer.css";
  import { openExternal } from "$lib/platform";
  import { nativePdfAvailable, openNativePdf, type NativePdf } from "$lib/platform/androidPdf";
  import { arrivesLater, serveFile, type ServedFile } from "$lib/services/mediaSource";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";
  import { wheelZoomFactor } from "$lib/ui/wheelZoom";
  import { nativePages, paintless, type Gesture } from "./pdfNativePages";

  interface Props {
    url: string;
    onerror: (missing: boolean) => void;
    zoomable?: boolean;
  }

  interface Engine {
    pdfjs: typeof import("pdfjs-dist");
    view: PDFViewer;
    links: PDFLinkService;
    eventBus: EventBus;
  }

  interface Pinch {
    distance: number;
    zoom: number;
    factor: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
  }

  const { url, onerror, zoomable = true }: Props = $props();

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const DOUBLE_TAP_ZOOM = 2.5;
  const DRAWING_DELAY = 250;
  const SHARPEN_INTERVAL = 150;
  const SCALE_STEPS = 100;
  const MAX_ROUND_UNIT = 8;
  const ALIGN_SLACK = 0.01;
  const HALF = 2;
  const EXTERNAL_LINK = /^(https?|mailto):/i;
  const MOUSE = "mouse";

  let container = $state<HTMLDivElement | null>(null);
  let pages = $state<HTMLDivElement | null>(null);
  let loading = $state(true);
  let zoom = $state(MIN_ZOOM);
  let engine = $state.raw<Engine | null>(null);

  const zoomed = $derived(zoom > MIN_ZOOM);

  let pageWidth = 0;
  let drawnUnit = { ratio: 0, unit: 0 };
  let onscreen = false;
  let sharpened = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;

  const points = new Map<number, { x: number; y: number }>();
  let pointer = MOUSE;
  let pinch: Pinch | null = null;
  let painter: ReturnType<typeof nativePages> | null = null;

  const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const roundUnit = () => {
    const ratio = window.devicePixelRatio || 1;
    if (drawnUnit.ratio === ratio && drawnUnit.unit > 0) return drawnUnit.unit;
    const drawn = parseFloat(pages?.querySelector<HTMLElement>(".page")?.style.getPropertyValue("--scale-round-x") ?? "");
    if (drawn > 0) {
      drawnUnit = { ratio, unit: drawn };
      return drawn;
    }
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

  const drifted = (view: PDFViewer, scale: number) =>
    Math.abs(scale - view.currentScale) > (zoomed ? 1 / SCALE_STEPS : 1 / SCALE_STEPS / SCALE_STEPS);

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
      if (view && scale !== null && drifted(view, scale)) apply(view, scale);
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

  const zoomTo = (next: number, origin: [number, number]) => {
    zoom = clamp(next);
    const scale = target();
    if (scale === null) return;
    scaleTo(scale, origin);
    settle();
  };

  const zoomAt = (next: number, clientX: number, clientY: number) => {
    const box = container;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    zoomTo(next, [clientX - rect.left, clientY - rect.top]);
  };

  const spread = () => {
    const [first, second] = [...points.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  };

  const centre = () => {
    const [first, second] = [...points.values()];
    return { x: (first.x + second.x) / HALF, y: (first.y + second.y) / HALF };
  };

  const grip = () => {
    const box = container;
    const host = pages;
    const distance = spread();
    if (!zoomable || !box || !host || pinch || points.size < 2 || distance <= 0) return;
    const focus = centre();
    const rect = box.getBoundingClientRect();
    pinch = {
      distance,
      zoom,
      factor: 1,
      x: box.scrollLeft + focus.x - rect.left,
      y: box.scrollTop + focus.y - rect.top,
      startX: focus.x,
      startY: focus.y,
      dx: 0,
      dy: 0,
    };
    host.style.transformOrigin = `${pinch.x}px ${pinch.y}px`;
    painter?.follow(gestureOf(pinch));
  };

  const gestureOf = (active: Pinch): Gesture => ({
    factor: active.factor,
    limit: MAX_ZOOM / active.zoom,
    x: active.x,
    y: active.y,
    dx: active.dx,
    dy: active.dy,
  });

  const pageAt = (x: number, y: number) => {
    const view = engine?.view;
    if (!view) return null;
    for (let index = 0; index < view.pagesCount; index++) {
      const div = view.getPageView(index)?.div as HTMLElement | undefined;
      if (!div || y > div.offsetTop + div.offsetHeight) continue;
      return { div, x: (x - div.offsetLeft) / div.offsetWidth, y: (y - div.offsetTop) / div.offsetHeight };
    }
    return null;
  };

  const release = () => {
    const active = pinch;
    const box = container;
    if (!active) return;
    pinch = null;
    if (pages) {
      pages.style.transform = "";
      pages.style.transformOrigin = "";
    }
    if (box) {
      const viewX = active.x - box.scrollLeft + active.dx;
      const viewY = active.y - box.scrollTop + active.dy;
      const anchor = pageAt(active.x, active.y);
      if (active.factor !== 1) zoomTo(active.zoom * active.factor, [viewX, viewY]);
      if (anchor) {
        if (zoomed) box.scrollLeft = anchor.div.offsetLeft + anchor.x * anchor.div.offsetWidth - viewX;
        box.scrollTop = anchor.div.offsetTop + anchor.y * anchor.div.offsetHeight - viewY;
      }
    }
    painter?.follow(null);
  };

  const onPointerDown = (event: PointerEvent) => {
    pointer = event.pointerType;
    if (event.isPrimary) points.clear();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    grip();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!pinch || !pages || points.size < 2) return;
    event.preventDefault();
    const focus = centre();
    pinch.factor = clamp((pinch.zoom * spread()) / pinch.distance) / pinch.zoom;
    pinch.dx = focus.x - pinch.startX;
    pinch.dy = focus.y - pinch.startY;
    pages.style.transform = `translate(${pinch.dx}px, ${pinch.dy}px) scale(${pinch.factor})`;
    painter?.follow(gestureOf(pinch));
  };

  const onPointerUp = (event: PointerEvent) => {
    points.delete(event.pointerId);
    if (points.size < 2) release();
  };

  const onWheel = (event: WheelEvent) => {
    if (!zoomable || !event.ctrlKey) return;
    event.preventDefault();
    zoomAt(zoom * wheelZoomFactor(event), event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (!zoomable || pointer === MOUSE) return;
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
        drawnUnit = { ratio: 0, unit: 0 };
        zoom = MIN_ZOOM;
        const scale = target();
        if (scale !== null) apply(view, scale);
        loading = false;
      });
      eventBus.on("pagerendered", () => {
        const scale = target();
        if (scale !== null && drifted(view, scale)) apply(view, scale);
        else center();
      });
      engine = { pdfjs, view, links, eventBus };
    };

    start().catch(() => {
      if (!cancelled) onerror(false);
    });
    const observer = new ResizeObserver(refit);
    observer.observe(box);
    const visibility = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
    });
    visibility.observe(box);
    const holdPinch = (event: TouchEvent) => {
      if (zoomable && event.touches.length > 1 && event.cancelable) event.preventDefault();
    };
    box.addEventListener("touchmove", holdPinch, { passive: false });

    return () => {
      cancelled = true;
      box.removeEventListener("touchmove", holdPinch);
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
    let served: ServedFile | null = null;
    let native: NativePdf | null = null;
    loading = true;

    const open = async () => {
      const file = await serveFile(source);
      if (cancelled) {
        file.close();
        return;
      }
      served = file;
      native = nativePdfAvailable() ? await openNativePdf(file.src).catch(() => null) : null;
      if (cancelled) {
        native?.close();
        return;
      }
      task = current.pdfjs.getDocument({ url: native?.file ?? file.src });
      const document_ = await task.promise;
      if (cancelled) return;
      if (native && pages && container) {
        paintless(document_);
        painter = nativePages(native, current.view, current.eventBus, container, pages);
      }
      current.view.setDocument(document_);
      current.links.setDocument(document_);
    };

    open().catch((error) => {
      if (!cancelled) onerror(arrivesLater(error));
    });

    return () => {
      cancelled = true;
      void task?.destroy();
      served?.close();
      if (painter) painter.destroy();
      else native?.close();
      painter = null;
    };
  });
</script>

<div class="relative min-h-0 flex-1">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    bind:this={container}
    class="absolute inset-0 touch-pan-x touch-pan-y overscroll-contain {zoomed
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
