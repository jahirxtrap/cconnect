import { isTouch } from "$lib/platform";

export interface ScrollbarOptions {
  touchIndicator?: boolean;
  wheel?: boolean;
  gutter?: boolean;
}

const HIT = 16;
const THICKNESS = 4;
const TOUCH_THICKNESS = 2;
const GAP = 2;
const IDLE = 35;
const ACTIVE = 65;

export function hscrollbar(node: HTMLElement, options: ScrollbarOptions = {}) {
  const { touchIndicator = true, wheel = false, gutter = true } = options;

  const thumb = document.createElement("div");
  thumb.style.cssText =
    "position:absolute;bottom:0;left:0;border-radius:999px;pointer-events:none;opacity:0";
  node.appendChild(thumb);

  if (getComputedStyle(node).position === "static") node.style.position = "relative";
  const basePadding = parseFloat(getComputedStyle(node).paddingBottom) || 0;

  let hovered = false;
  let dragging = false;
  let grab = 0;
  let frame = 0;

  const thickness = isTouch ? TOUCH_THICKNESS : THICKNESS;

  const contentWidth = () => {
    let end = 0;
    for (const child of node.children) {
      if (child === thumb || !(child instanceof HTMLElement)) continue;
      end = Math.max(end, child.offsetLeft + Math.max(child.offsetWidth, child.scrollWidth));
    }
    if (end) end += parseFloat(getComputedStyle(node).paddingRight) || 0;
    else {
      thumb.style.display = "none";
      end = node.scrollWidth;
      thumb.style.display = "";
    }
    return Math.max(end, node.clientWidth);
  };

  const maxScroll = () => Math.max(0, contentWidth() - node.clientWidth);

  const render = () => {
    frame = 0;
    const max = maxScroll();
    if (node.scrollLeft > max) node.scrollLeft = max;
    if (max <= 1 || (isTouch && !touchIndicator)) {
      thumb.style.opacity = "0";
      thumb.style.transform = "";
      thumb.style.width = "0px";
      node.style.cursor = "";
      node.style.paddingBottom = basePadding ? `${basePadding}px` : "";
      return;
    }
    if (!isTouch && gutter) node.style.paddingBottom = `${basePadding + thickness + GAP}px`;
    const viewport = node.clientWidth;
    const size = (viewport / contentWidth()) * viewport;
    const offset = (node.scrollLeft / max) * (viewport - size);
    const alpha = !isTouch && (hovered || dragging) ? ACTIVE : IDLE;
    node.style.cursor = hovered || dragging ? "pointer" : "";
    thumb.style.opacity = "1";
    thumb.style.height = `${thickness}px`;
    thumb.style.width = `${size}px`;
    thumb.style.transform = `translateX(${node.scrollLeft + offset}px)`;
    thumb.style.background = `color-mix(in srgb, var(--color-on-surface-variant) ${alpha}%, transparent)`;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(render);
  };

  const inZone = (event: PointerEvent) => {
    const bounds = node.getBoundingClientRect();
    return event.clientY - bounds.top >= bounds.height - HIT;
  };

  const scrollTo = (clientX: number) => {
    const max = maxScroll();
    const viewport = node.clientWidth;
    const size = (viewport / contentWidth()) * viewport;
    const track = Math.max(viewport - size, 1);
    const left = Math.min(Math.max(clientX - node.getBoundingClientRect().left - grab, 0), track);
    node.scrollLeft = (left / track) * max;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || dragging) return;
    const next = maxScroll() > 1 && inZone(event);
    if (next === hovered) return;
    hovered = next;
    schedule();
  };

  const onPointerLeave = () => {
    if (!hovered) return;
    hovered = false;
    schedule();
  };

  const onDragMove = (event: PointerEvent) => {
    scrollTo(event.clientX);
    schedule();
  };

  const onDragEnd = () => {
    dragging = false;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    window.removeEventListener("pointercancel", onDragEnd);
    schedule();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    if (maxScroll() <= 1 || !inZone(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const viewport = node.clientWidth;
    const size = (viewport / contentWidth()) * viewport;
    const track = Math.max(viewport - size, 1);
    const offset = (node.scrollLeft / maxScroll()) * track;
    const local = event.clientX - node.getBoundingClientRect().left;
    grab = local >= offset && local <= offset + size ? local - offset : size / 2;
    dragging = true;
    scrollTo(event.clientX);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
    window.addEventListener("pointercancel", onDragEnd);
    schedule();
  };

  const onClick = (event: MouseEvent) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onWheel = (event: WheelEvent) => {
    if (!event.deltaY || maxScroll() <= 1) return;
    event.preventDefault();
    node.scrollLeft += event.deltaY;
  };

  const resize = new ResizeObserver(schedule);
  resize.observe(node);
  const mutation = new MutationObserver(schedule);
  mutation.observe(node, { childList: true, subtree: true, characterData: true });

  node.addEventListener("scroll", schedule, { passive: true });
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerleave", onPointerLeave);
  node.addEventListener("pointerdown", onPointerDown, true);
  node.addEventListener("click", onClick, true);
  if (wheel) node.addEventListener("wheel", onWheel, { passive: false });
  schedule();

  return {
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      node.removeEventListener("scroll", schedule);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.removeEventListener("pointerdown", onPointerDown, true);
      node.removeEventListener("click", onClick, true);
      node.removeEventListener("wheel", onWheel);
      onDragEnd();
      node.style.cursor = "";
      thumb.remove();
    },
  };
}
