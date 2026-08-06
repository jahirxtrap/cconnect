<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    minScale?: number;
    maxScale?: number;
    class?: string;
    children: Snippet;
  }

  const { minScale = 1, maxScale = 6, class: className = "", children }: Props = $props();

  const DOUBLE_TAP_SCALE = 2.5;
  const WHEEL_STEP = 0.0015;
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

  const contain = () => {
    const box = host?.getBoundingClientRect();
    if (!box) return;
    const slackX = Math.max(0, (box.width * scale - box.width) / HALF);
    const slackY = Math.max(0, (box.height * scale - box.height) / HALF);
    offsetX = Math.min(slackX, Math.max(-slackX, offsetX));
    offsetY = Math.min(slackY, Math.max(-slackY, offsetY));
  };

  const spread = () => {
    const [first, second] = [...points.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.currentTarget as HTMLElement;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      pinchDistance = spread();
      pinchScale = scale;
      return;
    }
    if (scale <= minScale) return;
    target.setPointerCapture(event.pointerId);
    dragX = event.clientX;
    dragY = event.clientY;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!points.has(event.pointerId)) return;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size >= 2) {
      if (pinchDistance <= 0) return;
      event.preventDefault();
      scale = clamp((pinchScale * spread()) / pinchDistance);
      if (scale <= minScale) {
        offsetX = 0;
        offsetY = 0;
      } else contain();
      return;
    }
    if (scale <= minScale) return;
    event.preventDefault();
    offsetX += event.clientX - dragX;
    offsetY += event.clientY - dragY;
    dragX = event.clientX;
    dragY = event.clientY;
    contain();
  };

  const onPointerUp = (event: PointerEvent) => {
    points.delete(event.pointerId);
    if (points.size < 2) pinchDistance = 0;
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    scale = clamp(scale - event.deltaY * WHEEL_STEP);
    if (scale <= minScale) reset();
    else contain();
  };

  const onDoubleClick = () => {
    if (scale > minScale) reset();
    else scale = clamp(DOUBLE_TAP_SCALE);
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={host}
  class="relative touch-pan-y overflow-hidden {className}"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onwheel={onWheel}
  ondblclick={onDoubleClick}
>
  <div
    class="h-full w-full {scale > minScale ? 'cursor-grab' : ''}"
    style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: center center"
  >
    {@render children()}
  </div>
</div>
