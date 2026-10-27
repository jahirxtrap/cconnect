import { flushSync } from "svelte";
import { DRAG_PRESS_MS } from "./press";

const DRAG_THRESHOLD = 8;
const EDGE = 56;
const STEP = 12;
const HALF = 2;

export type StripCross = "stay" | "joined" | "left";

export interface StripOptions {
  group: string;
  strip: HTMLElement | null;
  onMove?: (id: string, index: number) => void;
  onSelect?: (id: string) => void;
  onDrop?: () => void;
  onCross?: (id: string, x: number, y: number) => StripCross;
}

const shared = $state({ id: "", group: "", dx: 0 });

export class StripDrag {
  #grabX = 0;
  #pointerX = 0;
  #chips = new Map<string, HTMLElement>();

  constructor(private readonly options: () => StripOptions) {}

  get held(): string {
    return shared.group === this.options().group ? shared.id : "";
  }

  get dx(): number {
    return shared.dx;
  }

  get dragging(): boolean {
    return shared.id !== "";
  }

  register = (element: HTMLElement, id: string) => {
    this.#chips.set(id, element);
    return { destroy: () => this.#chips.delete(id) };
  };

  widthOf = (id: string) => this.#chips.get(id)?.offsetWidth ?? 0;

  centerOf = (id: string) => {
    const element = this.#chips.get(id);
    return element ? element.offsetLeft + element.offsetWidth / HALF : 0;
  };

  reveal(id: string) {
    const strip = this.options().strip;
    if (!strip || this.dragging) return;
    const viewport = strip.clientWidth;
    if (viewport <= 0) return;
    const target = this.centerOf(id) - viewport / HALF;
    strip.scrollTo({
      left: Math.min(Math.max(target, 0), Math.max(strip.scrollWidth - viewport, 0)),
      behavior: "smooth",
    });
  }

  onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    this.#track(id, event.pointerId, event.clientX, event.clientY, event.pointerType === "touch", false);
  }

  adopt(id: string, pointerId: number, x: number) {
    this.#track(id, pointerId, x, 0, false, true);
  }

  #dragged() {
    return document.querySelector<HTMLElement>(
      `[data-strip="${this.options().group}"] [data-tab="${CSS.escape(shared.id)}"]`,
    );
  }

  #rowOf(chip: HTMLElement) {
    return [...(chip.parentElement?.querySelectorAll<HTMLElement>("[data-tab]") ?? [])];
  }

  #follow() {
    const chip = this.#dragged();
    if (!chip) return;
    shared.dx = this.#pointerX - this.#grabX - (chip.getBoundingClientRect().left - shared.dx);
  }

  #reorder() {
    const chip = this.#dragged();
    const onMove = this.options().onMove;
    if (!chip || !onMove) return;
    const row = this.#rowOf(chip);
    const from = row.indexOf(chip);
    const spacing = chip.parentElement ? Number.parseFloat(getComputedStyle(chip.parentElement).columnGap) || 0 : 0;
    if (shared.dx > 0 && from < row.length - 1) {
      const width = row[from + 1].offsetWidth;
      if (width > 0 && shared.dx > width / HALF + spacing) {
        onMove(shared.id, from + 1);
        shared.dx -= width + spacing;
      }
      return;
    }
    if (shared.dx < 0 && from > 0) {
      const width = row[from - 1].offsetWidth;
      if (width > 0 && shared.dx < -(width / HALF + spacing)) {
        onMove(shared.id, from - 1);
        shared.dx += width + spacing;
      }
    }
  }

  #insert() {
    const chip = this.#dragged();
    const onMove = this.options().onMove;
    if (!chip || !onMove) return;
    const row = this.#rowOf(chip).filter((node) => node !== chip);
    onMove(
      shared.id,
      row.filter((node) => node.getBoundingClientRect().left + node.offsetWidth / HALF < this.#pointerX).length,
    );
  }

  #maxScroll(scroller: HTMLElement) {
    const tail = scroller.lastElementChild as HTMLElement | null;
    return tail ? Math.max(0, tail.offsetLeft + tail.offsetWidth - scroller.clientWidth) : 0;
  }

  #autoScroll = () => {
    const chip = shared.id ? this.#dragged() : null;
    const scroller = chip?.parentElement;
    if (!chip || !scroller) return;
    const viewport = scroller.clientWidth;
    const limit = this.#maxScroll(scroller);
    const visible = chip.getBoundingClientRect().left + chip.offsetWidth / HALF - scroller.getBoundingClientRect().left;
    const direction =
      visible < EDGE && scroller.scrollLeft > 0 ? -1 : visible > viewport - EDGE && scroller.scrollLeft < limit ? 1 : 0;
    if (direction !== 0) {
      scroller.scrollLeft = Math.max(0, Math.min(scroller.scrollLeft + direction * STEP, limit));
      this.#follow();
      this.#reorder();
    }
    requestAnimationFrame(this.#autoScroll);
  };

  #start(id: string, x: number, centered: boolean) {
    const box = this.#chips.get(id)?.getBoundingClientRect();
    this.#grabX = box ? (centered ? box.width / HALF : x - box.left) : 0;
    this.#pointerX = x;
    shared.id = id;
    shared.group = this.options().group;
    shared.dx = 0;
    this.#autoScroll();
  }

  #end() {
    if (shared.id) this.options().onDrop?.();
    this.#reset();
  }

  #reset() {
    shared.id = "";
    shared.group = "";
    shared.dx = 0;
  }

  #track(id: string, pointerId: number, startX: number, startY: number, touch: boolean, adopted: boolean) {
    let started = adopted;
    let panning = false;
    let lastX = startX;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    if (adopted) this.#start(id, startX, true);
    else if (touch) timer = setTimeout(() => ((started = true), this.#start(id, startX, false)), DRAG_PRESS_MS);

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return;
      if (!started) {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (touch) {
          if (!panning && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            panning = Math.abs(dx) >= Math.abs(dy);
            if (!panning) {
              detach();
              return;
            }
          }
          const strip = this.options().strip;
          if (panning && strip) strip.scrollLeft -= move.clientX - lastX;
          lastX = move.clientX;
          return;
        }
        if (Math.abs(dx) <= DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        started = true;
        lastX = move.clientX;
        this.#start(id, move.clientX, false);
      }
      this.#pointerX = move.clientX;
      lastX = move.clientX;
      const crossed = flushSync((): StripCross => this.options().onCross?.(id, move.clientX, move.clientY) ?? "stay");
      if (crossed === "left") {
        detach();
        this.#reset();
        return;
      }
      if (crossed === "joined") flushSync(() => this.#insert());
      this.#follow();
      if (crossed === "stay") this.#reorder();
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== pointerId) return;
      detach();
      if (started) this.#end();
      else if (!panning) this.options().onSelect?.(id);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  }
}
