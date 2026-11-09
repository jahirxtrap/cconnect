const FIRST_ROWS = 48;
const SCREENS = 3;

export class RowWindow {
  #count: () => number;
  #first = $state(0);
  #span = $state(FIRST_ROWS);
  #height = $state(0);

  constructor(count: () => number) {
    this.#count = count;
  }

  get start(): number {
    return Math.min(this.#first, this.#count());
  }

  get end(): number {
    return Math.min(this.#count(), this.#first + this.#span);
  }

  get style(): string {
    return `padding-top: ${this.start * this.#height}px; padding-bottom: ${(this.#count() - this.end) * this.#height}px`;
  }

  slice = <T>(items: readonly T[]): T[] => items.slice(this.start, this.end);

  track = (node: HTMLElement) => {
    const scroller = node.parentElement;
    if (!scroller) return;
    let offset = 0;
    const place = () => {
      const height = this.#height;
      if (!height) return;
      const view = scroller.clientHeight;
      this.#first = Math.max(0, Math.floor((scroller.scrollTop - offset - view) / height));
      this.#span = Math.ceil((view * SCREENS) / height) + 1;
    };
    const measure = () => {
      const rows = node.children;
      if (rows.length) {
        const first = rows[0].getBoundingClientRect();
        const last = rows[rows.length - 1].getBoundingClientRect();
        this.#height = (last.bottom - first.top) / rows.length;
      }
      offset = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      place();
    };
    const sized = new ResizeObserver(measure);
    sized.observe(node);
    sized.observe(scroller);
    scroller.addEventListener("scroll", place, { passive: true });
    return {
      destroy: () => {
        sized.disconnect();
        scroller.removeEventListener("scroll", place);
      },
    };
  };
}
