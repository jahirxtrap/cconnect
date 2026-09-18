import { watchAndroidInsets } from "./androidInsets";
import { isTouch } from "./index";

export const COMPACT_WIDTH = 600;
const MENU_GAP = 8;

interface VirtualKeyboard extends EventTarget {
  overlaysContent: boolean;
  readonly boundingRect: DOMRect;
}

const virtualKeyboard = (navigator as Navigator & { virtualKeyboard?: VirtualKeyboard })
  .virtualKeyboard;

class Layout {
  width = $state(window.innerWidth);
  height = $state(window.innerHeight);
  bottomInset = $state(0);
  rightInset = $state(0);
  rightInsetAnimated = $state(true);
  transfersInset = $state(0);
  keyboard = $state(0);
  safeTop = $state(0);
  safeBottom = $state(0);
  safeLeft = $state(0);
  safeRight = $state(0);

  readonly mobile = $derived(this.height > this.width || this.width < COMPACT_WIDTH);
  readonly touch = isTouch;

  readonly menuPadding = $derived({
    top: this.safeTop + MENU_GAP,
    bottom: this.safeBottom + this.keyboard + MENU_GAP,
    left: this.safeLeft + MENU_GAP,
    right: this.safeRight + MENU_GAP,
  });

  start() {
    const native = watchAndroidInsets((insets) => {
      const root = document.documentElement.style;
      root.setProperty("--safe-top", `${insets.top}px`);
      root.setProperty("--safe-bottom", `${insets.bottom}px`);
      root.setProperty("--safe-left", `${insets.left}px`);
      root.setProperty("--safe-right", `${insets.right}px`);
      this.#applyKeyboard(insets.keyboard);
      this.#measureSafeArea();
    });

    if (!native && virtualKeyboard) virtualKeyboard.overlaysContent = true;

    $effect(() => {
      const measure = () => {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.#measureSafeArea();
      };
      measure();
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    });

    $effect(() => {
      if (native) return;
      const apply = (height: number) => this.#applyKeyboard(height);

      if (virtualKeyboard) {
        const track = () => apply(virtualKeyboard.boundingRect.height);
        track();
        virtualKeyboard.addEventListener("geometrychange", track);
        return () => virtualKeyboard.removeEventListener("geometrychange", track);
      }

      const viewport = window.visualViewport;
      if (!viewport) return;
      const track = () => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
        apply(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
      };
      track();
      viewport.addEventListener("resize", track);
      viewport.addEventListener("scroll", track);
      return () => {
        viewport.removeEventListener("resize", track);
        viewport.removeEventListener("scroll", track);
      };
    });
  }

  #applyKeyboard(height: number) {
    const next = Math.round(height);
    if (next === this.keyboard) return;
    const gone = next === 0 && this.keyboard > 0;
    this.keyboard = next;
    document.documentElement.style.setProperty("--keyboard", `${next}px`);
    if (gone && isTouch && document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  #measureSafeArea() {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
      "padding-top:var(--safe-top);padding-bottom:var(--safe-bottom);" +
      "padding-left:var(--safe-left);padding-right:var(--safe-right)";
    document.body.appendChild(probe);
    const style = getComputedStyle(probe);
    this.safeTop = parseFloat(style.paddingTop) || 0;
    this.safeBottom = parseFloat(style.paddingBottom) || 0;
    this.safeLeft = parseFloat(style.paddingLeft) || 0;
    this.safeRight = parseFloat(style.paddingRight) || 0;
    probe.remove();
  }
}

export const layout = new Layout();
