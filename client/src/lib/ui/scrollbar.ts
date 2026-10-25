import { isTouch } from "$lib/platform";

export const borderWidth = (node: HTMLElement) => {
  const style = getComputedStyle(node);
  return parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
};

export const scrollbarWidth = (node: HTMLElement, border = borderWidth(node)) => {
  if (node.scrollHeight <= node.clientHeight) return 0;
  return Math.max(0, node.offsetWidth - node.clientWidth - border);
};

export const scrollableAbove = (from: Element | null) => {
  let node = from as HTMLElement | null;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
    node = node.parentElement;
  }
  return null;
};

export const scrollableUnder = (x: number, y: number) =>
  scrollableAbove(document.elementFromPoint(x, y));

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
const SLEEP_MS = 900;
const FADE_MS = 180;

const scrolled = new WeakSet<HTMLElement>();

export function hscrollbar(node: HTMLElement, options: ScrollbarOptions = {}) {
  if (scrolled.has(node)) return { destroy() {} };
  scrolled.add(node);
  const { touchIndicator = false, wheel = false, gutter = false } = options;

  const lane = document.createElement("div");
  lane.style.cssText = "position:absolute;top:0;left:0;height:0;pointer-events:none";
  const rail = document.createElement("div");
  rail.style.cssText = "position:sticky;left:0;height:0";
  const thumb = document.createElement("div");
  thumb.style.cssText =
    "position:absolute;top:0;left:0;border-radius:999px;pointer-events:none;opacity:0;" +
    `transition:opacity ${FADE_MS}ms linear`;
  rail.appendChild(thumb);
  lane.appendChild(rail);
  node.appendChild(lane);

  if (getComputedStyle(node).position === "static") node.style.position = "relative";
  const basePadding = parseFloat(getComputedStyle(node).paddingBottom) || 0;

  let hovered = false;
  let dragging = false;
  let awake = false;
  let grab = 0;
  let frame = 0;
  let sleep: ReturnType<typeof setTimeout> | null = null;

  const thickness = isTouch ? TOUCH_THICKNESS : THICKNESS;

  const contentWidth = () => {
    let end = 0;
    for (const child of node.children) {
      if (child === lane || !(child instanceof HTMLElement)) continue;
      end = Math.max(end, child.offsetLeft + Math.max(child.offsetWidth, child.scrollWidth));
    }
    if (end) end += parseFloat(getComputedStyle(node).paddingRight) || 0;
    else {
      lane.style.display = "none";
      end = node.scrollWidth;
      lane.style.display = "";
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
    const content = contentWidth();
    const size = (viewport / content) * viewport;
    const offset = (node.scrollLeft / max) * (viewport - size);
    const alpha = !isTouch && (hovered || dragging) ? ACTIVE : IDLE;
    node.style.cursor = hovered || dragging ? "pointer" : "";
    lane.style.width = `${content}px`;
    lane.style.top = `${node.scrollTop + node.clientHeight - thickness}px`;
    rail.style.width = `${viewport}px`;
    thumb.style.opacity = awake || hovered || dragging ? "1" : "0";
    thumb.style.height = `${thickness}px`;
    thumb.style.width = `${size}px`;
    thumb.style.transform = `translateX(${offset}px)`;
    thumb.style.background = `rgba(var(--c-on-surface-variant-rgb), ${alpha / 100})`;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(render);
  };

  const wake = () => {
    awake = true;
    if (sleep !== null) clearTimeout(sleep);
    sleep = setTimeout(() => {
      sleep = null;
      awake = false;
      schedule();
    }, SLEEP_MS);
    schedule();
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

  node.addEventListener("scroll", wake, { passive: true });
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerleave", onPointerLeave);
  node.addEventListener("pointerdown", onPointerDown, true);
  node.addEventListener("click", onClick, true);
  if (wheel) node.addEventListener("wheel", onWheel, { passive: false });
  schedule();

  return {
    destroy() {
      scrolled.delete(node);
      if (frame) cancelAnimationFrame(frame);
      if (sleep !== null) clearTimeout(sleep);
      resize.disconnect();
      mutation.disconnect();
      node.removeEventListener("scroll", wake);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerleave", onPointerLeave);
      node.removeEventListener("pointerdown", onPointerDown, true);
      node.removeEventListener("click", onClick, true);
      node.removeEventListener("wheel", onWheel);
      onDragEnd();
      node.style.cursor = "";
      lane.remove();
    },
  };
}
