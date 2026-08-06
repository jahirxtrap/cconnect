<script lang="ts">
  import { authHeadersOf, backend } from "$lib/services/backend.svelte";
  import CenteredProgress from "$lib/ui/CenteredProgress.svelte";

  interface Props {
    url: string;
    onerror: () => void;
  }

  const { url, onerror }: Props = $props();

  const RENDER_SCALE = 2;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 5;
  const HALF = 2;

  let viewport = $state<HTMLDivElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let width = $state(0);
  let zoom = $state(1);
  let loading = $state(true);

  const points = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchZoom = 1;

  const render = async (container: HTMLDivElement, available: number) => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;

    const response = await fetch(url, { headers: authHeadersOf(backend.active) });
    if (!response.ok) throw new Error(String(response.status));
    const document_ = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;

    container.replaceChildren();
    for (let number = 1; number <= document_.numPages; number++) {
      const page = await document_.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const scale = (available / base.width) * RENDER_SCALE;
      const rendered = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(rendered.width);
      canvas.height = Math.floor(rendered.height);
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      container.appendChild(canvas);
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvas, canvasContext: context, viewport: rendered }).promise;
    }
  };

  const spread = () => {
    const [first, second] = [...points.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const centre = () => {
    const [first, second] = [...points.values()];
    return { x: (first.x + second.x) / HALF, y: (first.y + second.y) / HALF };
  };

  const applyZoom = (next: number, focusX: number, focusY: number) => {
    const box = viewport;
    if (!box) return;
    const previous = zoom;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (clamped === previous) return;
    const rect = box.getBoundingClientRect();
    const localX = focusX - rect.left + box.scrollLeft;
    const localY = focusY - rect.top + box.scrollTop;
    const ratio = clamped / previous;
    zoom = clamped;
    requestAnimationFrame(() => {
      box.scrollLeft = localX * ratio - (focusX - rect.left);
      box.scrollTop = localY * ratio - (focusY - rect.top);
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      pinchDistance = spread();
      pinchZoom = zoom;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size < 2 || pinchDistance <= 0) return;
    event.preventDefault();
    const focus = centre();
    applyZoom((pinchZoom * spread()) / pinchDistance, focus.x, focus.y);
  };

  const onPointerUp = (event: PointerEvent) => {
    points.delete(event.pointerId);
    if (points.size < 2) pinchDistance = 0;
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    applyZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    applyZoom(zoom > MIN_ZOOM ? MIN_ZOOM : HALF, event.clientX, event.clientY);
  };

  $effect(() => {
    const container = host;
    const available = width;
    if (!container || available <= 0) return;
    let cancelled = false;
    loading = true;
    render(container, available)
      .then(() => {
        if (!cancelled) loading = false;
      })
      .catch(() => {
        if (!cancelled) onerror();
      });
    return () => (cancelled = true);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={viewport}
  bind:clientWidth={width}
  class="scrollbar-thin relative min-h-0 flex-1 touch-pan-x touch-pan-y overflow-auto overscroll-contain bg-neutral-800"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onwheel={onWheel}
  ondblclick={onDoubleClick}
>
  <div bind:this={host} class="flex flex-col gap-2" style="width: {zoom * 100}%"></div>
  {#if loading}
    <CenteredProgress class="sticky inset-0 h-full" />
  {/if}
</div>
