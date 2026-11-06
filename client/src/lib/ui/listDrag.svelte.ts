import { followPointer } from "./followPointer";
import { DRAG_PRESS_MS, MOUSE_SLOP, TOUCH_SLOP } from "./press";

export interface Span {
  top: number;
  bottom: number;
}

export interface Landing {
  at: number;
  y: number;
}

const EDGE = 48;
const EDGE_STEP = 12;
const SCROLL_TICK_MS = 16;
const HALF = 2;

const swallow = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const blockScroll = (event: TouchEvent) => event.preventDefault();

const blockContext = (event: Event) => event.preventDefault();

export abstract class ListDrag<S extends Span, L extends Landing> {
  dragged = $state<string | null>(null);
  offset = $state(0);

  protected spans: S[] = [];
  protected from = $state(-1);
  protected to = $state(-1);
  protected height = $state(0);
  protected pointer = 0;

  #tick = $state(0);
  #touch = false;
  #startX = 0;
  #startY = 0;
  #grab = 0;
  #list: HTMLElement | null = null;
  #press: ReturnType<typeof setTimeout> | null = null;
  #pending: (() => void) | null = null;
  #scroller: number | null = null;
  #frame: number | null = null;
  #unfollow: (() => void) | null = null;

  protected abstract measure(list: HTMLElement): S[];

  protected abstract keyOf(span: S): string | null;

  protected abstract landings(): L[];

  protected abstract land(landing: L): void;

  protected abstract settle(id: string): (() => void) | null;

  protected started() {}

  protected leaves(_event: PointerEvent): boolean {
    return false;
  }

  protected cleared() {}

  get active(): boolean {
    return this.dragged !== null;
  }

  protected shiftOf(key: string | null): number {
    void this.#tick;
    if (!this.active || key === null || this.to < 0) return 0;
    const at = this.spans.findIndex((span) => this.keyOf(span) === key);
    if (at < 0 || at === this.from) return 0;
    if (at > this.from && at < this.to) return -this.height;
    if (at >= this.to && at < this.from) return this.height;
    return 0;
  }

  protected press(event: PointerEvent, id: string, list: HTMLElement | null) {
    if (event.button !== undefined && event.button !== 0) return;
    this.#hold(list, event.clientX, event.clientY, event.pointerType === "touch");
    const start = () => this.#start(id, false);
    if (this.#touch) this.#press = setTimeout(start, DRAG_PRESS_MS);
    else this.#pending = start;
  }

  protected take(id: string, x: number, y: number, touch: boolean, list: HTMLElement | null) {
    this.#hold(list, x, y, touch);
    this.#start(id, true);
  }

  #hold(list: HTMLElement | null, x: number, y: number, touch: boolean) {
    this.#list = list;
    this.#startX = x;
    this.#startY = y;
    this.pointer = y;
    this.#touch = touch;
    this.#unfollow?.();
    this.#unfollow = followPointer(this.#onMove, this.#onUp, false);
  }

  #start(id: string, centered: boolean) {
    this.#press = null;
    this.#pending = null;
    if (this.#touch) {
      window.addEventListener("touchmove", blockScroll, { passive: false });
      window.addEventListener("contextmenu", blockContext);
    }
    this.dragged = id;
    this.#measure();
    const span = this.spans[this.from];
    this.height = span ? span.bottom - span.top : 0;
    this.#grab = span ? (centered ? this.height / HALF : this.pointer - span.top) : 0;
    this.to = this.from;
    this.started();
    this.#watch();
  }

  #measure() {
    if (!this.#list) return;
    this.spans = this.measure(this.#list);
    this.from = this.spans.findIndex((span) => this.keyOf(span) === this.dragged);
    this.#tick++;
  }

  #watch() {
    const tick = () => {
      if (!this.active) {
        this.#frame = null;
        return;
      }
      this.#measure();
      this.#follow();
      this.#aim();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  #onMove = (event: PointerEvent) => {
    this.pointer = event.clientY;
    if (this.#pending) {
      if (Math.abs(event.clientY - this.#startY) < MOUSE_SLOP) return;
      this.#pending();
      return;
    }
    if (this.#press !== null) {
      const moved =
        Math.abs(event.clientY - this.#startY) > TOUCH_SLOP || Math.abs(event.clientX - this.#startX) > TOUCH_SLOP;
      if (moved) this.#clear();
      return;
    }
    if (!this.active) return;
    event.preventDefault();
    if (this.leaves(event)) {
      this.#clear();
      return;
    }
    this.#follow();
    this.#aim();
    this.#autoScroll();
  };

  #follow() {
    const span = this.spans[this.from];
    const first = this.spans[0];
    const last = this.spans[this.spans.length - 1];
    if (!span || !first || !last) {
      this.offset = this.pointer - this.#startY;
      return;
    }
    const wanted = this.pointer - this.#grab - span.top;
    this.offset = Math.max(first.top - span.top, Math.min(wanted, last.bottom - span.bottom));
  }

  #aim() {
    const span = this.spans[this.from];
    const top = span ? span.top + this.offset : this.pointer;
    let landing: L | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of this.landings()) {
      const y = candidate.at > this.from ? candidate.y - this.height : candidate.y;
      const distance = Math.abs(y - top);
      if (distance < nearest) {
        nearest = distance;
        landing = candidate;
      }
    }
    if (!landing) return;
    this.to = landing.at;
    this.land(landing);
  }

  #autoScroll() {
    const list = this.#list;
    if (!list) return;
    const box = list.getBoundingClientRect();
    const above = this.pointer - box.top;
    const below = box.bottom - this.pointer;
    const step = above < EDGE ? -EDGE_STEP : below < EDGE ? EDGE_STEP : 0;
    if (step === 0) {
      this.#stopScroll();
      return;
    }
    if (this.#scroller !== null) return;
    this.#scroller = window.setInterval(() => (list.scrollTop += step), SCROLL_TICK_MS);
  }

  #stopScroll() {
    if (this.#scroller !== null) window.clearInterval(this.#scroller);
    this.#scroller = null;
  }

  #onUp = () => {
    const id = this.dragged;
    const commit = id === null ? null : this.settle(id);
    this.#clear();
    if (id !== null) window.addEventListener("click", swallow, { capture: true, once: true });
    commit?.();
  };

  #clear() {
    if (this.#press !== null) clearTimeout(this.#press);
    this.#press = null;
    this.#pending = null;
    this.#stopScroll();
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.dragged = null;
    this.offset = 0;
    this.spans = [];
    this.height = 0;
    this.from = -1;
    this.to = -1;
    this.cleared();
    window.removeEventListener("touchmove", blockScroll);
    window.removeEventListener("contextmenu", blockContext);
    this.#unfollow?.();
    this.#unfollow = null;
  }
}
