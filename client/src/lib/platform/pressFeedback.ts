import { PRESS_FADE_MS, PRESS_HOLD_MS, PRESSABLE, TAP_TIMEOUT_MS, TOUCH_SLOP } from "$lib/ui/press";
import { scrollableAbove } from "$lib/ui/scrollbar";
import { isTouch } from "./index";

const DISABLED = ":disabled, [data-disabled], [aria-disabled='true']";
const SURFACE = "[data-press]:not([data-press='off'])";
const MUTED = "[data-press='off']";

export const trackPressFeedback = () => {
  if (!isTouch) return;

  let candidate: HTMLElement | null = null;
  let lit: HTMLElement | null = null;
  let originX = 0;
  let originY = 0;
  let shownAt = 0;
  let showTimer: ReturnType<typeof setTimeout> | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;

  const lift = () => {
    if (holdTimer !== null) clearTimeout(holdTimer);
    holdTimer = null;
    if (!lit) return;
    const faded = lit;
    faded.dataset.pressed = "off";
    setTimeout(() => {
      if (faded.dataset.pressed === "off") delete faded.dataset.pressed;
    }, PRESS_FADE_MS);
    lit = null;
  };

  const show = (target: HTMLElement) => {
    showTimer = null;
    lift();
    shownAt = performance.now();
    lit = target;
    target.dataset.pressed = "on";
  };

  const release = () => {
    if (!lit) return;
    const rest = PRESS_HOLD_MS - (performance.now() - shownAt);
    if (rest <= 0) lift();
    else holdTimer = setTimeout(lift, rest);
  };

  const drop = () => {
    candidate = null;
    if (showTimer !== null) clearTimeout(showTimer);
    showTimer = null;
  };

  const settle = () => {
    drop();
    release();
  };

  const radiusOf = (node: Element) => parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;

  const soleShape = (pressable: HTMLElement) => {
    const child = pressable.children.length === 1 ? (pressable.firstElementChild as HTMLElement) : null;
    return child && radiusOf(child) > 0 ? child : null;
  };

  const shapeOf = (from: Element, pressable: HTMLElement) => {
    let node: Element | null = from;
    let rounded: HTMLElement | null = null;
    while (node) {
      if (radiusOf(node) > 0) rounded = node as HTMLElement;
      if (node === pressable) break;
      node = node.parentElement;
    }
    return (
      rounded ?? soleShape(pressable) ?? pressable.parentElement?.closest<HTMLElement>(SURFACE) ?? pressable
    );
  };

  const aim = (target: HTMLElement, clientX: number, clientY: number) => {
    const box = target.getBoundingClientRect();
    const x = clientX - box.left;
    const y = clientY - box.top;
    const reach = Math.hypot(Math.max(x, box.width - x), Math.max(y, box.height - y));
    target.style.setProperty("--press-x", `${x}px`);
    target.style.setProperty("--press-y", `${y}px`);
    target.style.setProperty("--press-reach", `${reach}px`);
  };

  document.addEventListener(
    "pointerdown",
    (event) => {
      drop();
      const from = event.target instanceof Element ? event.target : null;
      const pressable = from?.closest<HTMLElement>(PRESSABLE) ?? null;
      if (!from || !pressable || pressable.matches(DISABLED) || pressable.closest(MUTED)) return;
      const target = shapeOf(from, pressable);
      aim(target, event.clientX, event.clientY);
      candidate = target;
      originX = event.clientX;
      originY = event.clientY;
      if (scrollableAbove(target)) showTimer = setTimeout(() => show(target), TAP_TIMEOUT_MS);
      else show(target);
    },
    true,
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      if (!candidate) return;
      const slipped =
        Math.abs(event.clientX - originX) > TOUCH_SLOP || Math.abs(event.clientY - originY) > TOUCH_SLOP;
      if (slipped) settle();
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    "pointerup",
    () => {
      const target = candidate;
      drop();
      if (!target) return;
      if (lit !== target) show(target);
      release();
    },
    true,
  );

  document.addEventListener("pointercancel", settle, true);
  document.addEventListener("scroll", settle, true);
};
