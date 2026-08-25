const SLOP = 10;
const DISMISS_RATIO = 0.35;
const MIN_DISMISS = 80;
const EXIT_MS = 180;

export interface SwipeDismissOptions {
  onDismiss: () => void;
}

export function swipeDismiss(node: HTMLElement, options: SwipeDismissOptions) {
  let dismiss = options.onDismiss;
  let startX = 0;
  let offset = 0;
  let tracking = false;
  let dragging = false;
  let pointer: number | null = null;

  const paint = (value: number, animate = false) => {
    node.style.transition = animate ? `transform ${EXIT_MS}ms ease-out, opacity ${EXIT_MS}ms ease-out` : "";
    node.style.transform = value ? `translateX(${value}px)` : "";
    node.style.opacity = value ? `${Math.max(0, 1 - Math.abs(value) / node.offsetWidth)}` : "";
  };

  const release = () => {
    if (pointer !== null && node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
    pointer = null;
    tracking = false;
    dragging = false;
    offset = 0;
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    startX = event.clientX;
    tracking = true;
    pointer = event.pointerId;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!tracking) return;
    const delta = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) <= SLOP) return;
      dragging = true;
      node.setPointerCapture(event.pointerId);
    }
    offset = delta;
    paint(offset);
  };

  const onPointerUp = () => {
    if (!tracking) return;
    const threshold = Math.max(MIN_DISMISS, node.offsetWidth * DISMISS_RATIO);
    const gone = Math.abs(offset) >= threshold;
    const target = offset > 0 ? node.offsetWidth : -node.offsetWidth;
    const wasDragging = dragging;
    release();
    if (!wasDragging) return;
    if (!gone) {
      paint(0, true);
      return;
    }
    paint(target, true);
    setTimeout(dismiss, EXIT_MS);
  };

  const onClick = (event: MouseEvent) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
  };

  node.style.touchAction = "pan-y";
  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerup", onPointerUp);
  node.addEventListener("pointercancel", () => {
    release();
    paint(0, true);
  });
  node.addEventListener("click", onClick, true);

  return {
    update(next: SwipeDismissOptions) {
      dismiss = next.onDismiss;
    },
    destroy() {
      release();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("click", onClick, true);
    },
  };
}
