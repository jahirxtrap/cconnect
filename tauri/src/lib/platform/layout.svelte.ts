import { isTouch } from "./index";

const MOBILE_MAX_WIDTH = 600;

class Layout {
  width = $state(window.innerWidth);
  height = $state(window.innerHeight);
  bottomInset = $state(0);

  readonly mobile = $derived(this.height > this.width || this.width < MOBILE_MAX_WIDTH);
  readonly touch = isTouch;

  start() {
    $effect(() => {
      const measure = () => {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
      };
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    });
  }
}

export const layout = new Layout();
