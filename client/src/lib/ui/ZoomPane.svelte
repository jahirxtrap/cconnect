<script lang="ts">
  import type { Snippet } from "svelte";
  import { wheelZoomFactor } from "./wheelZoom";

  interface Props {
    minScale?: number;
    maxScale?: number;
    active?: boolean;
    class?: string;
    children: Snippet;
  }

  const { minScale = 1, maxScale = 6, active = true, class: className = "", children }: Props = $props();

  const DOUBLE_TAP_SCALE = 2.5;
  const HALF = 2;

  let scale = $state(1);
  let offsetX = $state(0);
  let offsetY = $state(0);

  let host = $state<HTMLDivElement | null>(null);
  const points = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  let pinchScale = 1;
  let dragX = 0;
  let dragY = 0;

  const clamp = (value: number) => Math.min(maxScale, Math.max(minScale, value));

  const reset = () => {
    scale = minScale;
    offsetX = 0;
    offsetY = 0;
  };

  $effect(() => {
    if (!active) reset();
  });

  const spread = () => {
    const [first, second] = [...points.values()];
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  };

  const middle = () => {
    const [first, second] = [...points.values()];
    return { x: (first.x + second.x) / HALF, y: (first.y + second.y) / HALF };
  };

  const regrip = () => {
    if (points.size >= 2) {
      pinchDistance = spread();
      pinchScale = scale;
      return;
    }
    pinchDistance = 0;
    const [last] = [...points.values()];
    if (!last) return;
    dragX = last.x;
    dragY = last.y;
  };

  const zoomAt = (target: number, clientX: number, clientY: number) => {
    const next = clamp(target);
    const box = host?.getBoundingClientRect();
    if (box) {
      const pointX = clientX - box.left - box.width / HALF;
      const pointY = clientY - box.top - box.height / HALF;
      offsetX = pointX - ((pointX - offsetX) * next) / scale;
      offsetY = pointY - ((pointY - offsetY) * next) / scale;
    }
    scale = next;
    if (scale <= minScale) reset();
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (event.isPrimary) points.clear();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragX = event.clientX;
    dragY = event.clientY;
    if (points.size >= 2) {
      regrip();
      return;
    }
    if (scale <= minScale) return;
    target.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size >= 2) {
      if (pinchDistance <= 0) return;
      event.preventDefault();
      const center = middle();
      zoomAt((pinchScale * spread()) / pinchDistance, center.x, center.y);
      return;
    }
    if (scale <= minScale) return;
    event.preventDefault();
    offsetX += event.clientX - dragX;
    offsetY += event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
  };

  const release = (event: PointerEvent) => {
    points.delete(event.pointerId);
    regrip();
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    zoomAt(scale * wheelZoomFactor(event), event.clientX, event.clientY);
  };

  const onDoubleClick = (event: MouseEvent) => {
    if (scale > minScale) reset();
    else zoomAt(DOUBLE_TAP_SCALE, event.clientX, event.clientY);
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={host}
  class="relative overflow-hidden {scale > minScale ? 'touch-none' : 'touch-pan-x touch-pan-y'} {className}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={release}
  onpointercancel={release}
  onwheel={onWheel}
  ondblclick={onDoubleClick}
>
  <div
    class="h-full w-full cursor-pointer"
    style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: center center"
  >
    {@render children()}
  </div>
</div>
