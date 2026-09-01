import { isTouch, isTauri, platformName } from "./index";

const MOBILE_MAX_WIDTH = 600;
const MENU_GAP = 8;

const nativeKeyboardInsets = isTauri && platformName() === "android";

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

  readonly mobile = $derived(this.height > this.width || this.width < MOBILE_MAX_WIDTH);
  readonly touch = isTouch;

  readonly menuPadding = $derived({
    top: this.safeTop + MENU_GAP,
    bottom: this.safeBottom + MENU_GAP,
    left: this.safeLeft + MENU_GAP,
    right: this.safeRight + MENU_GAP,
  });

  start() {
    if (!nativeKeyboardInsets) {
      const keyboard = (navigator as Navigator & { virtualKeyboard?: { overlaysContent: boolean } })
        .virtualKeyboard;
      if (keyboard) keyboard.overlaysContent = true;
    }

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
      const viewport = window.visualViewport;
      if (!viewport || nativeKeyboardInsets) return;
      const track = () => {
        const hidden = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        this.keyboard = Math.round(hidden);
        document.documentElement.style.setProperty("--keyboard", `${this.keyboard}px`);
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

  #measureSafeArea() {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;" +
      "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);" +
      "padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)";
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
