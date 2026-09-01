const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 8;
const RELEASE_MS = 140;
const HALF = 2;

export interface Reorderable {
  id: string;
}

export class ReorderDrag {
  draggingId = $state<string | null>(null);
  dragX = $state(0);
  dragY = $state(0);
  dragTarget = $state(-1);
  releasing = $state(false);

  readonly releaseMs = RELEASE_MS;

  #cards = new Map<string, HTMLElement>();

  constructor(
    private readonly items: () => Reorderable[],
    private readonly onMove: (id: string, to: number) => void,
    private readonly onTap: (id: string) => void,
  ) {}

  register = (element: HTMLElement, id: string) => {
    this.#cards.set(id, element);
    return { destroy: () => this.#cards.delete(id) };
  };

  transitionOf(id: string) {
    const dragging = id === this.draggingId;
    return this.draggingId !== null && (!dragging || this.releasing)
      ? `transform ${RELEASE_MS}ms ease-out`
      : "none";
  }

  shiftOf(id: string, index: number) {
    if (id === this.draggingId) return { x: this.dragX, y: this.dragY };
    const from = this.#indexOf(this.draggingId);
    if (from < 0) return { x: 0, y: 0 };
    const target = this.dragTarget;
    const to =
      target >= from && index > from && index <= target
        ? index - 1
        : target >= 0 && target < from && index < from && index >= target
          ? index + 1
          : index;
    if (to === index) return { x: 0, y: 0 };
    const start = this.#centerOf(id);
    const into = this.#centerOf(this.items()[to]?.id ?? "");
    if (!start || !into) return { x: 0, y: 0 };
    return { x: into.x - start.x, y: into.y - start.y };
  }

  onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0 || this.releasing) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const touch = event.pointerType === "touch";
    let started = false;
    let lastX = startX;
    let lastY = startY;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const begin = () => {
      started = true;
      this.draggingId = id;
      this.dragX = 0;
      this.dragY = 0;
      this.dragTarget = this.#indexOf(id);
    };

    const detach = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    if (touch) timer = setTimeout(begin, LONG_PRESS_MS);

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== event.pointerId) return;
      if (!started) {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (touch) {
          if ((Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) && timer !== null) {
            clearTimeout(timer);
            timer = null;
            detach();
          }
          return;
        }
        if (Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return;
        begin();
        lastX = move.clientX;
        lastY = move.clientY;
      }
      this.dragX += move.clientX - lastX;
      this.dragY += move.clientY - lastY;
      lastX = move.clientX;
      lastY = move.clientY;
      const origin = this.#centerOf(id);
      if (!origin) return;
      const best = this.#nearest(origin.x + this.dragX, origin.y + this.dragY);
      if (best >= 0) this.dragTarget = best;
    };

    const onUp = (up: Event) => {
      if (up instanceof PointerEvent && up.pointerId !== event.pointerId) return;
      detach();
      if (!started) {
        this.onTap(id);
        return;
      }
      const from = this.#indexOf(id);
      const target = this.dragTarget;
      if (from >= 0 && target >= 0 && target !== from) this.#release(id, target);
      else this.#end();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  }

  #indexOf(id: string | null) {
    return id === null ? -1 : this.items().findIndex((item) => item.id === id);
  }

  #centerOf(id: string) {
    const element = this.#cards.get(id);
    if (!element) return null;
    return {
      x: element.offsetLeft + element.offsetWidth / HALF,
      y: element.offsetTop + element.offsetHeight / HALF,
    };
  }

  #nearest(x: number, y: number) {
    let best = -1;
    let bestDistance = Number.MAX_VALUE;
    this.items().forEach((item, index) => {
      const center = this.#centerOf(item.id);
      if (!center) return;
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  #release(id: string, to: number) {
    const from = this.#centerOf(id);
    const into = this.#centerOf(this.items()[to]?.id ?? "");
    if (!from || !into) {
      this.onMove(id, to);
      this.#end();
      return;
    }
    this.releasing = true;
    this.dragX = into.x - from.x;
    this.dragY = into.y - from.y;
    setTimeout(() => {
      this.onMove(id, to);
      this.releasing = false;
      this.#end();
    }, RELEASE_MS);
  }

  #end() {
    this.draggingId = null;
    this.dragX = 0;
    this.dragY = 0;
    this.dragTarget = -1;
  }
}
