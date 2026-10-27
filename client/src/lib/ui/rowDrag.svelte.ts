import { DRAG_PRESS_MS, MOUSE_SLOP, TOUCH_SLOP } from "./press";

export interface DropTarget {
  categoryId: string | null;
  index: number | null;
}

export interface RowOptions {
  list: HTMLElement | null;
  manual: boolean;
  origin: DropTarget;
  onExpand?: (categoryId: string) => void;
  onCommit: (id: string, target: DropTarget) => void;
  onOutside?: (id: string, event: PointerEvent) => boolean;
}

interface Slot {
  key: string;
  categoryId: string | null;
  index: number;
  header: boolean;
  spacer: boolean;
  collapsed: boolean;
  top: number;
  bottom: number;
}

interface Drop {
  categoryId: string | null;
  index: number;
  slotIndex: number;
  y: number;
}

export const SPRING_MS = 800;
const EDGE = 48;
const EDGE_STEP = 12;
const HALF = 2;

const swallow = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const blockScroll = (event: TouchEvent) => event.preventDefault();

const blockContext = (event: Event) => event.preventDefault();

export class RowDrag {
  id = $state<string | null>(null);
  target = $state<DropTarget | null>(null);
  offset = $state(0);

  #manual = false;
  #touch = false;
  #slots: Slot[] = [];
  #tick = $state(0);
  #origin = $state<DropTarget | null>(null);
  #height = $state(0);
  #from = $state(-1);
  #to = $state(-1);
  #gap = $state(false);
  #startX = 0;
  #startY = 0;
  #pointer = 0;
  #grab = 0;
  #list: HTMLElement | null = null;
  #press: ReturnType<typeof setTimeout> | null = null;
  #pending: (() => void) | null = null;
  #spring: ReturnType<typeof setTimeout> | null = null;
  #springOver: string | null = null;
  #scroller: number | null = null;
  #frame: number | null = null;
  #expand: ((categoryId: string) => void) | null = null;
  #commit: ((id: string, target: DropTarget) => void) | null = null;
  #outside: ((id: string, event: PointerEvent) => boolean) | null = null;

  get active(): boolean {
    return this.id !== null;
  }

  shiftFor(key: string): number {
    void this.#tick;
    if (!this.active || !this.#gap || this.#to < 0) return 0;
    const at = this.#slots.findIndex((slot) => slot.key === key);
    if (at < 0 || at === this.#from) return 0;
    if (at > this.#from && at < this.#to) return -this.#height;
    if (at >= this.#to && at < this.#from) return this.#height;
    return 0;
  }

  highlights(categoryId: string | null): boolean {
    return this.active && this.target?.categoryId === categoryId;
  }

  begin(event: PointerEvent, id: string, options: RowOptions) {
    if (event.button !== undefined && event.button !== 0) return;
    this.#configure(options, event.clientX, event.clientY, event.pointerType === "touch");
    const start = () => this.#start(id, false);
    if (this.#touch) this.#press = setTimeout(start, DRAG_PRESS_MS);
    else this.#pending = start;
  }

  adopt(id: string, x: number, y: number, touch: boolean, options: RowOptions) {
    this.#configure(options, x, y, touch);
    this.#start(id, true);
  }

  #configure(options: RowOptions, x: number, y: number, touch: boolean) {
    this.#list = options.list;
    this.#manual = options.manual;
    this.#expand = options.onExpand ?? null;
    this.#commit = options.onCommit;
    this.#outside = options.onOutside ?? null;
    this.#origin = options.origin;
    this.#startX = x;
    this.#startY = y;
    this.#pointer = y;
    this.#touch = touch;
    window.addEventListener("pointermove", this.#onMove);
    window.addEventListener("pointerup", this.#onUp);
    window.addEventListener("pointercancel", this.#onUp);
  }

  #start(id: string, centered: boolean) {
    this.#press = null;
    this.#pending = null;
    if (this.#touch) {
      window.addEventListener("touchmove", blockScroll, { passive: false });
      window.addEventListener("contextmenu", blockContext);
    }
    this.id = id;
    this.#measure();
    const row = this.#slots[this.#from];
    this.#height = row ? row.bottom - row.top : 0;
    this.#grab = row ? (centered ? this.#height / HALF : this.#pointer - row.top) : 0;
    this.#to = this.#from;
    this.target = this.#origin;
    this.#watch();
  }

  #measure() {
    const list = this.#list;
    if (!list) return;
    const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-row], [data-header], [data-spacer]"));
    this.#slots = nodes.map((node) => {
      const box = node.getBoundingClientRect();
      const header = node.dataset.header !== undefined;
      const spacer = node.dataset.spacer !== undefined;
      const key = spacer ? `spacer:${node.dataset.spacer}` : header ? `cat:${node.dataset.header}` : (node.dataset.row ?? "");
      return {
        key,
        categoryId: header ? (node.dataset.header ?? null) : node.dataset.group || null,
        index: header || spacer ? -1 : Number.parseInt(node.dataset.index ?? "0", 10),
        header,
        spacer,
        collapsed: node.dataset.collapsed === "true",
        top: box.top,
        bottom: box.bottom,
      };
    });
    this.#from = this.#slots.findIndex((slot) => slot.key === this.id);
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
    this.#pointer = event.clientY;
    if (this.#pending) {
      if (Math.abs(event.clientY - this.#startY) < MOUSE_SLOP) return;
      this.#pending();
      return;
    }
    if (this.#press !== null) {
      const moved =
        Math.abs(event.clientY - this.#startY) > TOUCH_SLOP || Math.abs(event.clientX - this.#startX) > TOUCH_SLOP;
      if (!moved) return;
      clearTimeout(this.#press);
      this.#press = null;
      this.#detach();
      return;
    }
    if (!this.active) return;
    event.preventDefault();
    if (this.id !== null && this.#outside?.(this.id, event)) {
      this.#detach();
      return;
    }
    this.#follow();
    this.#aim();
    this.#autoScroll();
  };

  #follow() {
    const row = this.#slots[this.#from];
    const first = this.#slots[0];
    const last = this.#slots[this.#slots.length - 1];
    if (!row || !first || !last) {
      this.offset = this.#pointer - this.#startY;
      return;
    }
    const wanted = this.#pointer - this.#grab - row.top;
    this.offset = Math.max(first.top - row.top, Math.min(wanted, last.bottom - row.bottom));
  }

  #drops(): Drop[] {
    const drops: Drop[] = [];
    const slots = this.#slots;
    let siblings = 0;
    for (let at = 0; at < slots.length; at++) {
      const slot = slots[at];
      if (slot.spacer) continue;
      const next = slots[at + 1];
      const ends = !next || next.header || next.spacer || next.categoryId !== slot.categoryId;
      if (slot.header) {
        siblings = 0;
        if (ends) drops.push({ categoryId: slot.categoryId, index: 0, slotIndex: at + 1, y: slot.bottom });
        continue;
      }
      drops.push({ categoryId: slot.categoryId, index: siblings, slotIndex: at, y: slot.top });
      if (slot.key !== this.id) siblings++;
      if (ends) drops.push({ categoryId: slot.categoryId, index: siblings, slotIndex: at + 1, y: slot.bottom });
    }
    return drops;
  }

  #aim() {
    const row = this.#slots[this.#from];
    const top = row ? row.top + this.offset : this.#pointer;
    let drop: Drop | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of this.#drops()) {
      const y = candidate.slotIndex > this.#from ? candidate.y - this.#height : candidate.y;
      const distance = Math.abs(y - top);
      if (distance < nearest) {
        nearest = distance;
        drop = candidate;
      }
    }
    if (!drop) return;
    this.#to = drop.slotIndex;
    this.#gap = true;
    this.target = { categoryId: drop.categoryId, index: this.#manual ? drop.index : null };
    const header = this.#slots[drop.slotIndex - 1];
    if (header?.header && header.collapsed && header.categoryId === drop.categoryId) this.#armSpring(header);
    else this.#disarmSpring();
  }

  #armSpring(header: Slot) {
    if (this.#springOver === header.categoryId) return;
    this.#disarmSpring();
    this.#springOver = header.categoryId;
    this.#spring = setTimeout(() => {
      if (header.categoryId) this.#expand?.(header.categoryId);
      this.#spring = null;
    }, SPRING_MS);
  }

  #disarmSpring() {
    if (this.#spring !== null) clearTimeout(this.#spring);
    this.#spring = null;
    this.#springOver = null;
  }

  #autoScroll() {
    const list = this.#list;
    if (!list) return;
    const box = list.getBoundingClientRect();
    const above = this.#pointer - box.top;
    const below = box.bottom - this.#pointer;
    const step = above < EDGE ? -EDGE_STEP : below < EDGE ? EDGE_STEP : 0;
    if (step === 0) {
      this.#stopScroll();
      return;
    }
    if (this.#scroller !== null) return;
    this.#scroller = window.setInterval(() => (list.scrollTop += step), 16);
  }

  #stopScroll() {
    if (this.#scroller !== null) window.clearInterval(this.#scroller);
    this.#scroller = null;
  }

  #onUp = () => {
    const id = this.id;
    const target = this.target;
    const origin = this.#origin;
    const dragged = this.active;
    this.#detach();
    if (dragged) window.addEventListener("click", swallow, { capture: true, once: true });
    if (!id || !target) return;
    const moved = target.categoryId !== origin?.categoryId || (target.index !== null && target.index !== origin?.index);
    if (moved) this.#commit?.(id, target);
  };

  #detach() {
    if (this.#press !== null) clearTimeout(this.#press);
    this.#press = null;
    this.#pending = null;
    this.#disarmSpring();
    this.#stopScroll();
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.id = null;
    this.target = null;
    this.#origin = null;
    this.offset = 0;
    this.#slots = [];
    this.#height = 0;
    this.#from = -1;
    this.#to = -1;
    this.#gap = false;
    window.removeEventListener("touchmove", blockScroll);
    window.removeEventListener("contextmenu", blockContext);
    window.removeEventListener("pointermove", this.#onMove);
    window.removeEventListener("pointerup", this.#onUp);
    window.removeEventListener("pointercancel", this.#onUp);
  }
}
