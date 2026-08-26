interface Block {
  categoryId: string;
  top: number;
  bottom: number;
}

interface Drop {
  beforeId: string | null;
  blockIndex: number;
  y: number;
}

const LONG_PRESS_MS = 400;
const MOUSE_SLOP = 4;
const TOUCH_SLOP = 8;
const EDGE = 48;
const EDGE_STEP = 12;

const swallow = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const blockScroll = (event: TouchEvent) => event.preventDefault();
const blockContext = (event: Event) => event.preventDefault();

export class CategoryDrag {
  categoryId = $state<string | null>(null);
  offset = $state(0);

  #blocks: Block[] = [];
  #tick = $state(0);
  #from = $state(-1);
  #to = $state(-1);
  #height = $state(0);
  #before: string | null = null;
  #touch = false;
  #startX = 0;
  #startY = 0;
  #pointer = 0;
  #grab = 0;
  #list: HTMLElement | null = null;
  #press: ReturnType<typeof setTimeout> | null = null;
  #pending: (() => void) | null = null;
  #scroller: number | null = null;
  #frame: number | null = null;
  #commit: ((categoryId: string, beforeId: string | null) => void) | null = null;

  get active(): boolean {
    return this.categoryId !== null;
  }

  shiftFor(categoryId: string | null): number {
    void this.#tick;
    if (!this.active || categoryId === null || this.#to < 0) return 0;
    const at = this.#blocks.findIndex((block) => block.categoryId === categoryId);
    if (at < 0 || at === this.#from) return 0;
    if (at > this.#from && at < this.#to) return -this.#height;
    if (at >= this.#to && at < this.#from) return this.#height;
    return 0;
  }

  dragging(categoryId: string | null): boolean {
    return this.active && categoryId === this.categoryId;
  }

  begin(
    event: PointerEvent,
    categoryId: string,
    options: { list: HTMLElement | null; onCommit: (categoryId: string, beforeId: string | null) => void },
  ) {
    if (event.button !== undefined && event.button !== 0) return;
    this.#list = options.list;
    this.#commit = options.onCommit;
    this.#startX = event.clientX;
    this.#startY = event.clientY;
    this.#pointer = event.clientY;
    this.#touch = event.pointerType === "touch";
    const start = () => this.#start(categoryId);
    if (this.#touch) this.#press = setTimeout(start, LONG_PRESS_MS);
    else this.#pending = start;
    window.addEventListener("pointermove", this.#onMove);
    window.addEventListener("pointerup", this.#onUp);
    window.addEventListener("pointercancel", this.#onUp);
  }

  #start(categoryId: string) {
    this.#press = null;
    this.#pending = null;
    if (this.#touch) {
      window.addEventListener("touchmove", blockScroll, { passive: false });
      window.addEventListener("contextmenu", blockContext);
    }
    this.categoryId = categoryId;
    this.#measure();
    const block = this.#blocks[this.#from];
    this.#height = block ? block.bottom - block.top : 0;
    this.#grab = block ? this.#pointer - block.top : 0;
    this.#to = this.#from;
    this.#before = null;
    this.#watch();
  }

  #measure() {
    const list = this.#list;
    if (!list) return;
    const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-header], [data-session]"));
    const blocks: Block[] = [];
    let current: Block | null = null;
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      if (node.dataset.header !== undefined) {
        current = { categoryId: node.dataset.header ?? "", top: box.top, bottom: box.bottom };
        blocks.push(current);
        continue;
      }
      const group = node.dataset.group || null;
      if (current && group === current.categoryId) current.bottom = box.bottom;
      else current = null;
    }
    this.#blocks = blocks;
    this.#from = blocks.findIndex((block) => block.categoryId === this.categoryId);
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

  #follow() {
    const block = this.#blocks[this.#from];
    const first = this.#blocks[0];
    const last = this.#blocks[this.#blocks.length - 1];
    if (!block || !first || !last) return;
    const wanted = this.#pointer - this.#grab - block.top;
    this.offset = Math.max(first.top - block.top, Math.min(wanted, last.bottom - block.bottom));
  }

  #drops(): Drop[] {
    const drops: Drop[] = this.#blocks.map((block, at) => ({
      beforeId: block.categoryId,
      blockIndex: at,
      y: block.top,
    }));
    const last = this.#blocks[this.#blocks.length - 1];
    if (last) drops.push({ beforeId: null, blockIndex: this.#blocks.length, y: last.bottom });
    return drops;
  }

  #aim() {
    const block = this.#blocks[this.#from];
    if (!block) return;
    const top = block.top + this.offset;
    let drop: Drop | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const candidate of this.#drops()) {
      const y = candidate.blockIndex > this.#from ? candidate.y - this.#height : candidate.y;
      const distance = Math.abs(y - top);
      if (distance < nearest) {
        nearest = distance;
        drop = candidate;
      }
    }
    if (!drop) return;
    this.#to = drop.blockIndex;
    this.#before = drop.beforeId;
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
    this.#follow();
    this.#aim();
    this.#autoScroll();
  };

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
    const categoryId = this.categoryId;
    const before = this.#before;
    const dragged = this.active;
    this.#detach();
    if (dragged) window.addEventListener("click", swallow, { capture: true, once: true });
    if (!categoryId || before === categoryId) return;
    this.#commit?.(categoryId, before);
  };

  #detach() {
    if (this.#press !== null) clearTimeout(this.#press);
    this.#press = null;
    this.#pending = null;
    this.#stopScroll();
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.categoryId = null;
    this.offset = 0;
    this.#blocks = [];
    this.#from = -1;
    this.#to = -1;
    this.#height = 0;
    this.#before = null;
    window.removeEventListener("touchmove", blockScroll);
    window.removeEventListener("contextmenu", blockContext);
    window.removeEventListener("pointermove", this.#onMove);
    window.removeEventListener("pointerup", this.#onUp);
    window.removeEventListener("pointercancel", this.#onUp);
  }
}
