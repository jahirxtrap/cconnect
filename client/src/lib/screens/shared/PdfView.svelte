<script lang="ts">
  import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
  import { tick, untrack } from "svelte";
  import { authHeadersOf, backend } from "$lib/services/backend.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";

  interface Props {
    url: string;
    onerror: () => void;
  }

  const { url, onerror }: Props = $props();

  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const DOUBLE_TAP_ZOOM = 2.5;
  const WHEEL_STEP = 0.0015;
  const HALF = 2;
  const PAGE_PIXELS = 12e6;
  const SHARPEN_MS = 200;
  const SHARPEN_MARGIN = 600;

  let viewport = $state<HTMLDivElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let width = $state(0);
  let baseHeight = $state(0);
  let zoom = $state(1);
  let loading = $state(true);

  const points = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchZoom = 1;
  let dragX = 0;
  let dragY = 0;

  let pages: PDFPageProxy[] = [];
  let canvases: HTMLCanvasElement[] = [];
  let factors: number[] = [];
  let task: RenderTask | null = null;
  let generation = 0;
  let sharpenTimer: ReturnType<typeof setTimeout> | null = null;

  const clamp = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  const density = () => window.devicePixelRatio || 1;

  const paint = async (index: number, available: number, factor: number) => {
    const page = pages[index];
    const canvas = canvases[index];
    const base = page.getViewport({ scale: 1 });
    const cap = Math.sqrt(PAGE_PIXELS / (base.width * base.height));
    const rendered = page.getViewport({ scale: Math.min((available / base.width) * factor, cap) });
    factors[index] = 0;
    canvas.width = Math.floor(rendered.width);
    canvas.height = Math.floor(rendered.height);
    const context = canvas.getContext("2d");
    if (!context) return;
    task = page.render({ canvas, canvasContext: context, viewport: rendered });
    await task.promise;
    task = null;
    factors[index] = factor;
  };

  const onscreen = () => {
    const box = viewport;
    if (!box) return canvases.map((_, index) => index);
    const rect = box.getBoundingClientRect();
    const indexes: number[] = [];
    canvases.forEach((canvas, index) => {
      const area = canvas.getBoundingClientRect();
      if (area.bottom > rect.top - SHARPEN_MARGIN && area.top < rect.bottom + SHARPEN_MARGIN) {
        indexes.push(index);
      }
    });
    return indexes;
  };

  const sharpen = async () => {
    const mine = ++generation;
    const factor = density() * zoom;
    const targets = zoom > MIN_ZOOM ? onscreen() : canvases.map((_, index) => index);
    for (const index of targets) {
      if (mine !== generation) return;
      if (factors[index] === factor) continue;
      try {
        await paint(index, width, factor);
      } catch {
        return;
      }
    }
  };

  const scheduleSharpen = () => {
    if (sharpenTimer !== null) clearTimeout(sharpenTimer);
    sharpenTimer = setTimeout(() => {
      sharpenTimer = null;
      if (loading) {
        scheduleSharpen();
        return;
      }
      task?.cancel();
      void sharpen();
    }, SHARPEN_MS);
  };

  const render = async (container: HTMLDivElement, available: number) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;

    const response = await fetch(url, { headers: authHeadersOf(backend.active) });
    if (!response.ok) throw new Error(String(response.status));
    const document_ = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;

    container.replaceChildren();
    pages = [];
    canvases = [];
    factors = [];
    const factor = density();
    for (let number = 1; number <= document_.numPages; number++) {
      const page = await document_.getPage(number);
      const canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      container.appendChild(canvas);
      pages.push(page);
      canvases.push(canvas);
      factors.push(0);
      await paint(pages.length - 1, available, factor);
    }
    baseHeight = container.offsetHeight;
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
    if (points.size >= 2) {
      pinchDistance = spread();
      pinchZoom = zoom;
      return;
    }
    pinchDistance = 0;
    const [last] = [...points.values()];
    if (!last) return;
    dragX = last.x;
    dragY = last.y;
  };

  const zoomAt = async (target: number, clientX: number, clientY: number) => {
    const box = viewport;
    if (!box) return;
    const next = clamp(target);
    if (next === zoom) return;
    const rect = box.getBoundingClientRect();
    const focusX = clientX - rect.left;
    const focusY = clientY - rect.top;
    const ratio = next / zoom;
    const left = (box.scrollLeft + focusX) * ratio - focusX;
    const top = (box.scrollTop + focusY) * ratio - focusY;
    zoom = next;
    await tick();
    box.scrollLeft = left;
    box.scrollTop = top;
    scheduleSharpen();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.isPrimary) points.clear();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragX = event.clientX;
    dragY = event.clientY;
    if (points.size >= 2) {
      regrip();
      return;
    }
    if (event.pointerType !== "touch" || zoom <= MIN_ZOOM) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size >= 2) {
      if (pinchDistance <= 0) return;
      event.preventDefault();
      const focus = centre();
      void zoomAt((pinchZoom * spread()) / pinchDistance, focus.x, focus.y);
      return;
    }
    if (event.pointerType !== "touch" || zoom <= MIN_ZOOM) return;
    event.preventDefault();
    const box = viewport;
    if (box) {
      box.scrollLeft -= event.clientX - dragX;
      box.scrollTop -= event.clientY - dragY;
    }
    dragX = event.clientX;
    dragY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent) => {
    points.delete(event.pointerId);
    regrip();
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    void zoomAt(zoom - event.deltaY * WHEEL_STEP * zoom, event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    void zoomAt(zoom > MIN_ZOOM ? MIN_ZOOM : DOUBLE_TAP_ZOOM, event.clientX, event.clientY);
  };

  const onScroll = () => {
    if (zoom > MIN_ZOOM) scheduleSharpen();
  };

  $effect(() => {
    const container = host;
    const available = width;
    if (!container || available <= 0 || untrack(() => zoom) > MIN_ZOOM) return;
    let cancelled = false;
    loading = true;
    render(container, available)
      .then(() => {
        if (!cancelled) loading = false;
      })
      .catch(() => {
        if (!cancelled) onerror();
      });
    return () => {
      cancelled = true;
      generation++;
      if (sharpenTimer !== null) clearTimeout(sharpenTimer);
      task?.cancel();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={viewport}
  bind:clientWidth={width}
  class="scrollbar-thin relative min-h-0 flex-1 overflow-auto overscroll-contain bg-neutral-800 {zoom >
  MIN_ZOOM
    ? 'touch-none'
    : 'touch-pan-y'}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onwheel={onWheel}
  ondblclick={onDoubleClick}
  onscroll={onScroll}
>
  <div class="relative" style="width: {width * zoom}px; height: {baseHeight * zoom}px">
    <div
      bind:this={host}
      class="absolute left-0 top-0 flex flex-col gap-2"
      style="width: {width}px; transform: scale({zoom}); transform-origin: 0 0"
    ></div>
  </div>
  {#if loading}
    <CenteredProgress class="sticky inset-0 h-full" />
  {/if}
</div>
