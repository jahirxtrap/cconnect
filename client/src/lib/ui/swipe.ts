import { FLING_SPEED, Velocity } from "./velocity";

const SLOP = 10;
const DISMISS_RATIO = 0.35;
const MIN_DISMISS = 80;
export const SWIPE_MS = 180;
const SWIPE_ATTRIBUTE = "data-swipe";

export const OWN_SWIPE = { [SWIPE_ATTRIBUTE]: "" };

export const swipeOwner = (target: EventTarget | null) =>
  target instanceof Element ? target.closest(`[${SWIPE_ATTRIBUTE}]`) : null;

export interface SwipeDismissOptions {
  onDismiss: (() => void) | null;
}

export function swipeDismiss(node: HTMLElement, options: SwipeDismissOptions) {
  let dismiss = options.onDismiss;
  let startX = 0;
  let offset = 0;
  let tracking = false;
  let dragging = false;
  let pointer: number | null = null;
  const velocity = new Velocity();

  const paint = (value: number, animate = false) => {
    node.style.transition = animate ? `transform ${SWIPE_MS}ms ease-out, opacity ${SWIPE_MS}ms ease-out` : "";
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
    if (dismiss === null || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (swipeOwner(event.target) !== node) return;
    startX = event.clientX;
    tracking = true;
    pointer = event.pointerId;
    velocity.start(event.clientX, event.timeStamp);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!tracking) return;
    velocity.add(event.clientX, event.timeStamp);
    const delta = event.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) <= SLOP) return;
      dragging = true;
      node.setPointerCapture(event.pointerId);
    }
    offset = delta;
    paint(offset);
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!tracking) return;
    const threshold = Math.max(MIN_DISMISS, node.offsetWidth * DISMISS_RATIO);
    const speed = velocity.at(event.timeStamp);
    const flung = Math.abs(speed) > FLING_SPEED && Math.sign(speed) === Math.sign(offset);
    const gone = flung || Math.abs(offset) >= threshold;
    const target = offset > 0 ? node.offsetWidth : -node.offsetWidth;
    const wasDragging = dragging;
    release();
    if (!wasDragging) return;
    if (!gone) {
      paint(0, true);
      return;
    }
    paint(target, true);
    const settle = dismiss;
    setTimeout(() => settle?.(), SWIPE_MS);
  };

  const onClick = (event: MouseEvent) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
  };

  node.style.touchAction = "pan-y";
  node.setAttribute(SWIPE_ATTRIBUTE, "");
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
      node.removeAttribute(SWIPE_ATTRIBUTE);
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", onPointerUp);
      node.removeEventListener("click", onClick, true);
    },
  };
}
