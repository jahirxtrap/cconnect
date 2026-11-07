import { untrack } from "svelte";

class ScreenCover {
  #layers = $state<HTMLElement[]>([]);

  hold(layer: HTMLElement): () => void {
    this.#layers = [...untrack(() => this.#layers), layer];
    return () => {
      this.#layers = untrack(() => this.#layers).filter((item) => item !== layer);
    };
  }

  hides(node: HTMLElement | null): boolean {
    return node !== null && this.#layers.some((layer) => !layer.contains(node));
  }
}

export const screenCover = new ScreenCover();
