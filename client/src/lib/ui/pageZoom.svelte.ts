import { settings } from "$lib/data/settings.svelte";
import { ZOOM_NOTCH, zoomStep } from "./zoomLevels";

class PageZoom {
  #wheeled = 0;

  get value(): number {
    return settings.pageZoom;
  }

  step(direction: number) {
    const next = zoomStep(settings.pageZoom, direction);
    if (next !== undefined) settings.pageZoom = next;
  }

  reset() {
    settings.pageZoom = 1;
  }

  wheel(delta: number) {
    this.#wheeled += delta;
    if (Math.abs(this.#wheeled) < ZOOM_NOTCH) return;
    this.step(this.#wheeled < 0 ? 1 : -1);
    this.#wheeled = 0;
  }
}

export const pageZoom = new PageZoom();
