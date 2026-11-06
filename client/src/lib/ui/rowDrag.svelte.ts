import { ListDrag } from "./listDrag.svelte";

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
  at: number;
  y: number;
}

export const SPRING_MS = 800;

export class RowDrag extends ListDrag<Slot, Drop> {
  target = $state<DropTarget | null>(null);

  #manual = false;
  #origin = $state<DropTarget | null>(null);
  #spring: ReturnType<typeof setTimeout> | null = null;
  #springOver: string | null = null;
  #expand: ((categoryId: string) => void) | null = null;
  #commit: ((id: string, target: DropTarget) => void) | null = null;
  #outside: ((id: string, event: PointerEvent) => boolean) | null = null;

  get id(): string | null {
    return this.dragged;
  }

  shiftFor(key: string): number {
    return this.shiftOf(key);
  }

  highlights(categoryId: string | null): boolean {
    return this.active && this.target?.categoryId === categoryId;
  }

  begin(event: PointerEvent, id: string, options: RowOptions) {
    this.#configure(options);
    this.press(event, id, options.list);
  }

  adopt(id: string, x: number, y: number, touch: boolean, options: RowOptions) {
    this.#configure(options);
    this.take(id, x, y, touch, options.list);
  }

  #configure(options: RowOptions) {
    this.#manual = options.manual;
    this.#expand = options.onExpand ?? null;
    this.#commit = options.onCommit;
    this.#outside = options.onOutside ?? null;
    this.#origin = options.origin;
  }

  protected measure(list: HTMLElement): Slot[] {
    const nodes = Array.from(list.querySelectorAll<HTMLElement>("[data-row], [data-header], [data-spacer]"));
    return nodes.map((node) => {
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
  }

  protected keyOf(slot: Slot): string {
    return slot.key;
  }

  protected started() {
    this.target = this.#origin;
  }

  protected leaves(event: PointerEvent): boolean {
    return this.dragged !== null && (this.#outside?.(this.dragged, event) ?? false);
  }

  protected landings(): Drop[] {
    const drops: Drop[] = [];
    const slots = this.spans;
    let siblings = 0;
    for (let at = 0; at < slots.length; at++) {
      const slot = slots[at];
      if (slot.spacer) continue;
      const next = slots[at + 1];
      const ends = !next || next.header || next.spacer || next.categoryId !== slot.categoryId;
      if (slot.header) {
        siblings = 0;
        if (ends) drops.push({ categoryId: slot.categoryId, index: 0, at: at + 1, y: slot.bottom });
        continue;
      }
      drops.push({ categoryId: slot.categoryId, index: siblings, at, y: slot.top });
      if (slot.key !== this.dragged) siblings++;
      if (ends) drops.push({ categoryId: slot.categoryId, index: siblings, at: at + 1, y: slot.bottom });
    }
    return drops;
  }

  protected land(drop: Drop) {
    this.target = { categoryId: drop.categoryId, index: this.#manual ? drop.index : null };
    const header = this.spans[drop.at - 1];
    if (header?.header && header.collapsed && header.categoryId === drop.categoryId) this.#armSpring(header);
    else this.#disarmSpring();
  }

  protected settle(id: string): (() => void) | null {
    const target = this.target;
    const origin = this.#origin;
    const commit = this.#commit;
    if (!target) return null;
    const moved = target.categoryId !== origin?.categoryId || (target.index !== null && target.index !== origin?.index);
    return moved ? () => commit?.(id, target) : null;
  }

  protected cleared() {
    this.#disarmSpring();
    this.target = null;
    this.#origin = null;
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
}
